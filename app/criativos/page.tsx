"use client";

// Tela /criativos: gerar o criativo do dia, editar, aprovar ("Pode postar") e configurar os horários.
import { useCallback, useEffect, useState } from "react";

const DOURADO = "#c9a24a";
const CREME = "#f2e6c9";
const FUNDO_CARTAO = "#141210";
const BORDA = "#3a3226";
const CHAVE_LS = "armag_ig_key";

type Status = "rascunho" | "agendado" | "publicando" | "publicado" | "erro" | "cancelado";
type Criativo = {
  id: string;
  tipo: "Serviço" | "Dica";
  titulo: string;
  titulo_px: number | null;
  subtitulo: string;
  itens: string[];
  cta: string;
  legenda: string;
  tema: string;
  image_url: string | null;
  status: Status;
  agendado_para: string | null;
  agendado_texto: string | null;
  publicado_em: string | null;
  permalink: string | null;
  erro: string | null;
  tentativas: number;
};
type Horario = { dia_semana: number; hora: string; ativo: boolean };

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const LIMITES = { titulo: 40, subtitulo: 110, item: 35, cta: 60, legenda: 2200 };

const lerLS = () => {
  try {
    return localStorage.getItem(CHAVE_LS) ?? "";
  } catch {
    return "";
  }
};
const gravarLS = (v: string | null) => {
  try {
    if (v) localStorage.setItem(CHAVE_LS, v);
    else localStorage.removeItem(CHAVE_LS);
  } catch {}
};

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

/* ---------- estilos ---------- */
const s = {
  main: { maxWidth: 760, margin: "0 auto", padding: "28px 16px 80px" } as React.CSSProperties,
  cartao: { background: FUNDO_CARTAO, border: `1px solid ${BORDA}`, borderRadius: 16, padding: 18, marginTop: 18 } as React.CSSProperties,
  h2: { color: DOURADO, fontSize: 18, margin: "0 0 14px", letterSpacing: 0.3 } as React.CSSProperties,
  campo: {
    width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 10, border: `1px solid ${BORDA}`,
    background: "#0f0e0c", color: CREME, fontSize: 15, fontFamily: "inherit",
  } as React.CSSProperties,
  botaoOuro: (desligado = false): React.CSSProperties => ({
    padding: "13px 18px", borderRadius: 12, border: "none", background: desligado ? "#5a4a28" : DOURADO, color: "#0b0b0b",
    fontWeight: 800, fontSize: 16, cursor: desligado ? "not-allowed" : "pointer",
  }),
  botao: (desligado = false): React.CSSProperties => ({
    padding: "10px 14px", borderRadius: 10, border: `1px solid ${BORDA}`, background: "transparent", color: CREME,
    fontWeight: 600, fontSize: 14, cursor: desligado ? "not-allowed" : "pointer", opacity: desligado ? 0.5 : 1,
  }),
  link: { background: "none", border: "none", color: DOURADO, cursor: "pointer", fontSize: 14, padding: 0, textDecoration: "underline" } as React.CSSProperties,
  selo: { display: "inline-block", background: DOURADO, color: "#0b0b0b", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" } as React.CSSProperties,
  aviso: (tipo: "ok" | "erro" | "info"): React.CSSProperties => ({
    marginTop: 12, padding: 12, borderRadius: 10, fontSize: 14,
    background: tipo === "ok" ? "#14291a" : tipo === "erro" ? "#2e1414" : "#1d1a12",
    border: `1px solid ${tipo === "ok" ? "#2f6b3d" : tipo === "erro" ? "#7a2e2e" : BORDA}`,
  }),
  linha: { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", padding: "10px 0", borderTop: `1px solid ${BORDA}` } as React.CSSProperties,
  mini: { width: 64, height: 64, borderRadius: 8, objectFit: "cover", border: `1px solid ${BORDA}`, flex: "none" } as React.CSSProperties,
};

function Contador({ valor, max }: { valor: string; max: number }) {
  const n = [...valor].length;
  return <small style={{ opacity: n > max ? 1 : 0.6, color: n > max ? "#ff7b7b" : undefined }}>{n}/{max}</small>;
}

export default function Criativos() {
  const [chave, setChave] = useState("");
  const [entrada, setEntrada] = useState("");
  const [pronto, setPronto] = useState(false);

  const [atual, setAtual] = useState<Criativo | null>(null);
  const [agendados, setAgendados] = useState<Criativo[]>([]);
  const [publicados, setPublicados] = useState<Criativo[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);

  const [ocupado, setOcupado] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro" | "info"; texto: string } | null>(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ titulo: "", subtitulo: "", itens: ["", "", "", ""], cta: "", legenda: "" });

  useEffect(() => {
    setChave(lerLS());
    setPronto(true);
  }, []);

  const api = useCallback(
    async <T,>(caminho: string, opts: { method?: string; body?: unknown } = {}): Promise<T> => {
      const res = await fetch(caminho, {
        method: opts.method ?? "GET",
        headers: { "x-api-key": chave, ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}) },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
      const json = (await res.json().catch(() => ({}))) as T & { erro?: string };
      if (res.status === 401) {
        gravarLS(null);
        setChave("");
        throw new Error("Chave inválida. Entre de novo.");
      }
      if (!res.ok) throw new Error(json.erro || `Erro ${res.status}`);
      return json;
    },
    [chave],
  );

  const carregar = useCallback(async () => {
    try {
      const [r, a, p, h] = await Promise.all([
        api<{ criativos: Criativo[] }>("/api/criativos?status=rascunho&limite=1"),
        api<{ criativos: Criativo[] }>("/api/criativos?status=agendado,publicando"),
        api<{ criativos: Criativo[] }>("/api/criativos?status=publicado,erro&limite=20"),
        api<{ horarios: Horario[] }>("/api/horarios"),
      ]);
      setAtual(r.criativos[0] ?? null);
      setAgendados([...a.criativos].sort((x, y) => (x.agendado_para ?? "").localeCompare(y.agendado_para ?? "")));
      setPublicados(p.criativos);
      setHorarios(h.horarios.map((x) => ({ ...x, hora: x.hora.slice(0, 5) })));
    } catch (e) {
      setMsg({ tipo: "erro", texto: String(e instanceof Error ? e.message : e) });
    }
  }, [api]);

  useEffect(() => {
    if (chave) void carregar();
  }, [chave, carregar]);

  async function acao(rotulo: string, fn: () => Promise<void>) {
    setOcupado(rotulo);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setOcupado(null);
    }
  }

  function gerar(descartar?: string) {
    return acao("gerar", async () => {
      setEditando(false);
      const r = await api<{ criativo: Criativo }>("/api/criativos/gerar", { method: "POST", body: descartar ? { descartar_id: descartar } : {} });
      setAtual(r.criativo);
    });
  }

  function abrirEdicao(c: Criativo) {
    setForm({ titulo: c.titulo, subtitulo: c.subtitulo, itens: [0, 1, 2, 3].map((i) => c.itens[i] ?? ""), cta: c.cta, legenda: c.legenda });
    setEditando(true);
  }

  function salvarEdicao(c: Criativo) {
    return acao("editar", async () => {
      const r = await api<{ criativo: Criativo }>(`/api/criativos/${c.id}`, {
        method: "PATCH",
        body: { ...form, itens: form.itens.map((i) => i.trim()).filter(Boolean) },
      });
      setAtual(r.criativo);
      setEditando(false);
      setMsg({ tipo: "ok", texto: "Textos salvos e imagem regenerada." });
    });
  }

  function aprovar(c: Criativo) {
    return acao("aprovar", async () => {
      const r = await api<{ criativo: Criativo }>(`/api/criativos/${c.id}/aprovar`, { method: "POST" });
      setMsg({ tipo: "ok", texto: `Agendado para ${r.criativo.agendado_texto}.` });
      await carregar();
    });
  }

  function publicarAgora(c: Criativo) {
    if (!window.confirm("Publicar agora no Instagram @armag.soft? Isso não pode ser desfeito.")) return;
    return acao("publicar", async () => {
      const r = await api<{ criativo?: Criativo }>(`/api/criativos/${c.id}/publicar-agora`, { method: "POST" });
      setMsg({ tipo: "ok", texto: `Publicado! ${r.criativo?.permalink ?? ""}` });
      await carregar();
    });
  }

  function cancelar(c: Criativo) {
    return acao(`cancelar-${c.id}`, async () => {
      await api(`/api/criativos/${c.id}/cancelar`, { method: "POST" });
      setMsg({ tipo: "info", texto: `"${c.titulo}" voltou para rascunho.` });
      await carregar();
    });
  }

  function tentarDeNovo(c: Criativo) {
    return acao(`retry-${c.id}`, async () => {
      const r = await api<{ criativo: Criativo }>(`/api/criativos/${c.id}/aprovar`, { method: "POST" });
      setMsg({ tipo: "ok", texto: `Reagendado para ${r.criativo.agendado_texto}.` });
      await carregar();
    });
  }

  function salvarHorarios() {
    return acao("horarios", async () => {
      const r = await api<{ horarios: Horario[] }>("/api/horarios", { method: "PUT", body: { horarios } });
      setHorarios(r.horarios.map((x) => ({ ...x, hora: x.hora.slice(0, 5) })));
      setMsg({ tipo: "ok", texto: "Horários salvos. Valem para os próximos agendamentos." });
    });
  }

  async function copiarLegenda(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setMsg({ tipo: "info", texto: "Legenda copiada." });
    } catch {
      setMsg({ tipo: "erro", texto: "Não consegui copiar. Selecione o texto e copie manualmente." });
    }
  }

  if (!pronto) return null;

  /* ---------- acesso ---------- */
  if (!chave) {
    return (
      <main style={s.main}>
        <h1 style={{ color: DOURADO, fontSize: 26, margin: "0 0 4px" }}>ARMAG · Criativos</h1>
        <p style={{ opacity: 0.7, margin: "0 0 20px" }}>Entre com a chave de acesso do app.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            gravarLS(entrada);
            setChave(entrada);
          }}
          style={{ display: "grid", gap: 12 }}
        >
          <input type="password" value={entrada} onChange={(e) => setEntrada(e.target.value)} placeholder="Chave de acesso" required style={s.campo} />
          <button type="submit" style={s.botaoOuro()}>Entrar</button>
        </form>
      </main>
    );
  }

  const gerando = ocupado === "gerar";
  const c = atual;

  return (
    <main style={s.main}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ color: DOURADO, fontSize: 26, margin: 0 }}>ARMAG · Criativos</h1>
          <p style={{ opacity: 0.7, margin: "4px 0 0", fontSize: 14 }}>Instagram @armag.soft</p>
        </div>
        <button
          style={s.botao()}
          onClick={() => {
            gravarLS(null);
            setChave("");
            setEntrada("");
          }}
        >
          Sair
        </button>
      </div>

      {msg && <div style={s.aviso(msg.tipo)}>{msg.texto}</div>}

      {/* 1. Criativo do dia */}
      <section style={s.cartao}>
        <h2 style={s.h2}>Criativo do dia</h2>
        {!c && (
          <button style={{ ...s.botaoOuro(gerando), width: "100%", fontSize: 18, padding: 18 }} disabled={!!ocupado} onClick={() => void gerar()}>
            {gerando ? <TextoCarregando /> : "Gerar criativo do dia"}
          </button>
        )}

        {c && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", borderRadius: 12, overflow: "hidden", border: `1px solid ${BORDA}`, background: "#070707" }}>
              {c.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.image_url} alt={c.titulo} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: ocupado ? 0.5 : 1 }} />
              ) : (
                <div style={{ display: "grid", placeItems: "center", height: "100%", opacity: 0.6 }}>Sem imagem</div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={s.selo}>{c.tipo}</span>
              <span style={{ opacity: 0.7, fontSize: 13 }}>Tema: {c.tema}</span>
            </div>

            {!editando ? (
              <>
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0, fontSize: 15, lineHeight: 1.5, background: "#0f0e0c", padding: 14, borderRadius: 10, border: `1px solid ${BORDA}` }}>
                  {c.legenda}
                </pre>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={s.botao(!!ocupado)} disabled={!!ocupado} onClick={() => void copiarLegenda(c.legenda)}>Copiar legenda</button>
                  <button style={s.botao(!!ocupado)} disabled={!!ocupado} onClick={() => abrirEdicao(c)}>Editar textos</button>
                  <button style={s.botao(!!ocupado)} disabled={!!ocupado} onClick={() => void gerar(c.id)}>
                    {gerando ? "Gerando outro…" : "Gerar outro"}
                  </button>
                </div>
                <button style={{ ...s.botaoOuro(!!ocupado), width: "100%", fontSize: 18, padding: 16 }} disabled={!!ocupado} onClick={() => void aprovar(c)}>
                  {ocupado === "aprovar" ? "Agendando…" : "Pode postar"}
                </button>
                <div style={{ textAlign: "center" }}>
                  <button style={s.link} disabled={!!ocupado} onClick={() => void publicarAgora(c)}>
                    {ocupado === "publicar" ? "Publicando… (até 30 s)" : "Publicar agora"}
                  </button>
                </div>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void salvarEdicao(c);
                }}
                style={{ display: "grid", gap: 12 }}
              >
                <Campo rotulo="Título" valor={form.titulo} max={LIMITES.titulo} onChange={(v) => setForm({ ...form, titulo: v })} />
                <Campo rotulo="Subtítulo" valor={form.subtitulo} max={LIMITES.subtitulo} onChange={(v) => setForm({ ...form, subtitulo: v })} />
                {form.itens.map((item, i) => (
                  <Campo
                    key={i}
                    rotulo={`Tópico ${i + 1} (opcional)`}
                    valor={item}
                    max={LIMITES.item}
                    onChange={(v) => setForm({ ...form, itens: form.itens.map((x, j) => (j === i ? v : x)) })}
                  />
                ))}
                <Campo rotulo="CTA" valor={form.cta} max={LIMITES.cta} onChange={(v) => setForm({ ...form, cta: v })} />
                <Campo rotulo="Legenda" valor={form.legenda} max={LIMITES.legenda} multilinha onChange={(v) => setForm({ ...form, legenda: v })} />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="submit" style={s.botaoOuro(!!ocupado)} disabled={!!ocupado}>
                    {ocupado === "editar" ? "Desenhando a arte…" : "Salvar e regenerar imagem"}
                  </button>
                  <button type="button" style={s.botao()} onClick={() => setEditando(false)}>Cancelar</button>
                </div>
              </form>
            )}
          </div>
        )}
      </section>

      {/* 2. Agendados */}
      <section style={s.cartao}>
        <h2 style={s.h2}>Agendados</h2>
        {agendados.length === 0 && <p style={{ opacity: 0.6, margin: 0 }}>Nenhum post agendado.</p>}
        {agendados.map((a) => (
          <div key={a.id} style={s.linha}>
            {a.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.image_url} alt="" style={s.mini} />
            )}
            <div style={{ flex: "1 1 180px", minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{a.titulo}</div>
              <div style={{ fontSize: 13, opacity: 0.75 }}>
                {a.status === "publicando" ? "Publicando agora…" : `Agendado para ${a.agendado_texto}`}
                {a.erro && a.status === "agendado" ? ` · nova tentativa (${a.tentativas}/3): ${a.erro}` : ""}
              </div>
            </div>
            {a.status === "agendado" && (
              <button style={s.botao(!!ocupado)} disabled={!!ocupado} onClick={() => void cancelar(a)}>Cancelar agendamento</button>
            )}
          </div>
        ))}
      </section>

      {/* 3. Publicados */}
      <section style={s.cartao}>
        <h2 style={s.h2}>Publicados</h2>
        {publicados.length === 0 && <p style={{ opacity: 0.6, margin: 0 }}>Nada publicado por aqui ainda.</p>}
        {publicados.map((p) => (
          <div key={p.id} style={{ ...s.linha, ...(p.status === "erro" ? { background: "#2e1414", borderRadius: 10, padding: 10, marginTop: 6 } : {}) }}>
            {p.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt="" style={s.mini} />
            )}
            <div style={{ flex: "1 1 180px", minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{p.titulo}</div>
              {p.status === "publicado" ? (
                <div style={{ fontSize: 13, opacity: 0.75 }}>
                  {dataHora(p.publicado_em)}{" "}
                  {p.permalink && (
                    <a href={p.permalink} target="_blank" rel="noreferrer" style={{ color: DOURADO }}>Ver no Instagram</a>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#ff9b9b" }}>Erro: {p.erro}</div>
              )}
            </div>
            {p.status === "erro" && (
              <button style={s.botao(!!ocupado)} disabled={!!ocupado} onClick={() => void tentarDeNovo(p)}>Tentar de novo</button>
            )}
          </div>
        ))}
      </section>

      {/* 4. Horários */}
      <section style={s.cartao}>
        <h2 style={s.h2}>Horários de postagem</h2>
        <p style={{ fontSize: 13, opacity: 0.7, margin: "0 0 10px" }}>
          Os posts aprovados saem no horário do dia. Se o horário de hoje já passou, vai para o próximo dia ativo.
        </p>
        {horarios.map((h) => (
          <div key={h.dia_semana} style={{ ...s.linha, justifyContent: "space-between" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={h.ativo}
                onChange={(e) => setHorarios(horarios.map((x) => (x.dia_semana === h.dia_semana ? { ...x, ativo: e.target.checked } : x)))}
                style={{ width: 20, height: 20, accentColor: DOURADO }}
              />
              <span style={{ opacity: h.ativo ? 1 : 0.5 }}>{DIAS[h.dia_semana]}</span>
            </label>
            <input
              type="time"
              value={h.hora}
              disabled={!h.ativo}
              onChange={(e) => setHorarios(horarios.map((x) => (x.dia_semana === h.dia_semana ? { ...x, hora: e.target.value } : x)))}
              style={{ ...s.campo, width: 130, opacity: h.ativo ? 1 : 0.5 }}
            />
          </div>
        ))}
        <button style={{ ...s.botaoOuro(!!ocupado), marginTop: 12, width: "100%" }} disabled={!!ocupado || horarios.length === 0} onClick={() => void salvarHorarios()}>
          {ocupado === "horarios" ? "Salvando…" : "Salvar horários"}
        </button>
      </section>
    </main>
  );
}

function Campo({ rotulo, valor, max, onChange, multilinha }: { rotulo: string; valor: string; max: number; onChange: (v: string) => void; multilinha?: boolean }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
        {rotulo} <Contador valor={valor} max={max} />
      </span>
      {multilinha ? (
        <textarea value={valor} onChange={(e) => onChange(e.target.value)} rows={9} style={{ ...s.campo, resize: "vertical" }} />
      ) : (
        <input value={valor} onChange={(e) => onChange(e.target.value)} style={s.campo} />
      )}
    </label>
  );
}

/** "Criando texto…" e depois "Desenhando a arte…" enquanto o pedido roda. */
function TextoCarregando() {
  const [fase, setFase] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setFase(1), 12000);
    return () => clearTimeout(t);
  }, []);
  return <>{fase === 0 ? "Criando texto…" : "Desenhando a arte…"}</>;
}
