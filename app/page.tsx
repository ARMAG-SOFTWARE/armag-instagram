"use client";

import { useEffect, useState } from "react";

const DOURADO = "#c9a24a";

type Resultado = { ok: boolean; erro?: string; permalink?: string; mediaId?: string };

export default function Home() {
  const [chave, setChave] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [legenda, setLegenda] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  // lembra a chave só neste navegador
  useEffect(() => {
    try {
      const salva = localStorage.getItem("armag_ig_key");
      if (salva) setChave(salva);
    } catch {}
  }, []);

  useEffect(() => {
    if (!arquivo) return setPreview(null);
    const url = URL.createObjectURL(arquivo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  async function publicar(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) return;
    setEnviando(true);
    setResultado(null);
    try {
      try {
        localStorage.setItem("armag_ig_key", chave);
      } catch {}
      const form = new FormData();
      form.append("imagem", arquivo);
      form.append("legenda", legenda);
      const res = await fetch("/api/instagram/publicar", {
        method: "POST",
        headers: { "x-api-key": chave },
        body: form,
      });
      const json = (await res.json()) as Resultado;
      setResultado(json);
      if (json.ok) {
        setArquivo(null);
        setLegenda("");
      }
    } catch (err) {
      setResultado({ ok: false, erro: String(err) });
    } finally {
      setEnviando(false);
    }
  }

  const campo: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #3a3226",
    background: "#151310",
    color: "#f2e6c9",
    fontSize: 15,
  };

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ color: DOURADO, fontSize: 26, margin: "0 0 4px" }}>ARMAG</h1>
      <p style={{ margin: "0 0 28px", opacity: 0.7 }}>Publicar no Instagram @armag.soft</p>

      <form onSubmit={publicar} style={{ display: "grid", gap: 16 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Chave de acesso</span>
          <input
            type="password"
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            placeholder="INSTAGRAM_PUBLISH_SECRET"
            required
            style={campo}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Imagem (JPG ou PNG)</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            required
            style={campo}
          />
        </label>

        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Prévia"
            style={{ width: "100%", borderRadius: 12, border: "1px solid #3a3226" }}
          />
        )}

        <label style={{ display: "grid", gap: 6 }}>
          <span>
            Legenda <small style={{ opacity: 0.6 }}>({legenda.length}/2200)</small>
          </span>
          <textarea
            value={legenda}
            onChange={(e) => setLegenda(e.target.value)}
            maxLength={2200}
            rows={6}
            placeholder="Escreva a legenda, com #hashtags se quiser"
            style={{ ...campo, resize: "vertical" }}
          />
        </label>

        <button
          type="submit"
          disabled={enviando || !arquivo}
          style={{
            padding: "14px",
            borderRadius: 10,
            border: "none",
            background: enviando || !arquivo ? "#5a4a28" : DOURADO,
            color: "#0b0b0b",
            fontWeight: 700,
            fontSize: 16,
            cursor: enviando || !arquivo ? "not-allowed" : "pointer",
          }}
        >
          {enviando ? "Publicando… (pode levar até 30 s)" : "Publicar no Instagram"}
        </button>
      </form>

      {resultado && (
        <div
          style={{
            marginTop: 20,
            padding: 14,
            borderRadius: 10,
            background: resultado.ok ? "#14291a" : "#2e1414",
            border: `1px solid ${resultado.ok ? "#2f6b3d" : "#7a2e2e"}`,
          }}
        >
          {resultado.ok ? (
            <>
              Publicado!{" "}
              {resultado.permalink && (
                <a href={resultado.permalink} target="_blank" rel="noreferrer" style={{ color: DOURADO }}>
                  Ver post
                </a>
              )}
            </>
          ) : (
            <>Erro: {resultado.erro}</>
          )}
        </div>
      )}
    </main>
  );
}
