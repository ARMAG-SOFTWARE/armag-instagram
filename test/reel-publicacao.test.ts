import { describe, expect, it } from "vitest";
import { avancarReel, iniciarReel, LIMITE_PROCESSAMENTO_MIN, type DepsReel } from "@/lib/criativos/reel";
import type { Criativo, Status } from "@/lib/criativos/dados";

const base = (o: Partial<Criativo> = {}): Criativo => ({
  id: "r1", criado_em: "", tipo: "Dica", titulo: "t", titulo_px: null, subtitulo: "s", itens: [], cta: "c", legenda: "leg #armag",
  tema: "x", image_url: "https://x/capa.jpg", status: "agendado", agendado_para: "2026-11-18T15:00:00Z", publicado_em: null,
  media_id: null, permalink: null, erro: null, tentativas: 0, formato: "reel", roteiro: "r", video_url: "https://x/v.mp4",
  container_id: null, processando_desde: null, slides: [], imagens: [], ...o,
});

function fakes(opts: { status?: string; criarFalha?: boolean; travaLivre?: boolean } = {}) {
  let linha = base();
  const chamadas: string[] = [];
  const deps: DepsReel = {
    agora: () => new Date("2026-11-18T15:05:00Z"),
    criarContainerReel: async (video, legenda, capa) => {
      chamadas.push(`criar ${video} ${capa}`);
      if (opts.criarFalha) throw new Error("Graph API: vídeo inválido");
      return "cont1";
    },
    statusContainer: async (id) => {
      chamadas.push(`status ${id}`);
      return opts.status ?? "FINISHED";
    },
    publicarContainer: async (id) => {
      chamadas.push(`publicar ${id}`);
      return { mediaId: "m1", permalink: "https://instagram.com/reel/x" };
    },
    travar: async (_id, de: Status[], para: Status) => {
      if (opts.travaLivre === false || !de.includes(linha.status)) return null;
      linha = { ...linha, status: para };
      return linha;
    },
    atualizar: async (_id, patch) => {
      linha = { ...linha, ...patch };
      return linha;
    },
  };
  return { deps, chamadas, linha: () => linha, set: (o: Partial<Criativo>) => (linha = { ...linha, ...o }) };
}

describe("etapa 1: iniciarReel", () => {
  it("trava agendado→processando, cria o container e grava o id (sem publicar)", async () => {
    const f = fakes();
    const r = await iniciarReel(f.linha(), ["agendado"], f.deps);
    expect(r.resultado).toBe("processando");
    expect(f.linha()).toMatchObject({ status: "processando", container_id: "cont1", processando_desde: "2026-11-18T15:05:00.000Z" });
    expect(f.chamadas).toEqual(["criar https://x/v.mp4 https://x/capa.jpg"]);
  });
  it("outro processo já pegou → ocupado, nada criado", async () => {
    const f = fakes({ travaLivre: false });
    expect((await iniciarReel(f.linha(), ["agendado"], f.deps)).resultado).toBe("ocupado");
    expect(f.chamadas).toEqual([]);
  });
  it("sem vídeo → erro, sem chamar o Instagram", async () => {
    const f = fakes();
    f.set({ video_url: null });
    const r = await iniciarReel(f.linha(), ["agendado"], f.deps);
    expect(r.resultado).toBe("erro");
    expect(f.chamadas).toEqual([]);
  });
  it("falha ao criar container → volta a agendado em 10 min (tentativa 1)", async () => {
    const f = fakes({ criarFalha: true });
    await iniciarReel(f.linha(), ["agendado"], f.deps);
    expect(f.linha()).toMatchObject({ status: "agendado", tentativas: 1, agendado_para: "2026-11-18T15:15:00.000Z" });
    expect(f.linha().erro).toMatch(/vídeo inválido/);
  });
});

describe("etapa 2: avancarReel", () => {
  const processando = (o: Partial<Criativo> = {}) => ({ status: "processando" as Status, container_id: "cont1", processando_desde: "2026-11-18T15:00:00Z", ...o });
  it("FINISHED → publica e marca publicado", async () => {
    const f = fakes({ status: "FINISHED" });
    f.set(processando());
    const r = await avancarReel(f.linha(), f.deps);
    expect(r.resultado).toBe("publicado");
    expect(f.linha()).toMatchObject({ status: "publicado", media_id: "m1", permalink: "https://instagram.com/reel/x", container_id: null });
  });
  it("IN_PROGRESS → continua processando, sem publicar", async () => {
    const f = fakes({ status: "IN_PROGRESS" });
    f.set(processando());
    expect((await avancarReel(f.linha(), f.deps)).resultado).toBe("aguardando");
    expect(f.linha().status).toBe("processando");
    expect(f.chamadas).toEqual(["status cont1"]);
  });
  it(`IN_PROGRESS há mais de ${LIMITE_PROCESSAMENTO_MIN} min → erro com nova tentativa`, async () => {
    const f = fakes({ status: "IN_PROGRESS" });
    f.set(processando({ processando_desde: "2026-11-18T14:30:00Z" }));
    await avancarReel(f.linha(), f.deps);
    expect(f.linha()).toMatchObject({ status: "agendado", tentativas: 1, container_id: null });
    expect(f.linha().erro).toMatch(/tempo/i);
  });
  it("ERROR na 3ª tentativa → erro definitivo", async () => {
    const f = fakes({ status: "ERROR" });
    f.set(processando({ tentativas: 2 }));
    await avancarReel(f.linha(), f.deps);
    expect(f.linha()).toMatchObject({ status: "erro", tentativas: 3 });
  });
  it("duas execuções em paralelo: só uma publica", async () => {
    const f = fakes({ status: "FINISHED" });
    f.set(processando());
    const c = f.linha();
    const [a, b] = await Promise.all([avancarReel(c, f.deps), avancarReel(c, f.deps)]);
    expect([a.resultado, b.resultado].sort()).toEqual(["ocupado", "publicado"]);
    expect(f.chamadas.filter((x) => x.startsWith("publicar"))).toHaveLength(1);
  });
});
