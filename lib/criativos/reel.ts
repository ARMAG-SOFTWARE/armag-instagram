// Publicação de Reels em duas etapas (cada chamada do cron termina em poucos segundos):
//  1) iniciarReel: trava agendado→processando e cria o container no Instagram.
//  2) avancarReel: nas chamadas seguintes, quando o container fica FINISHED, trava processando→publicando e publica.
import { criarContainerReel, publicarContainer, statusContainer } from "@/lib/instagram";
import { atualizar, travar, type Criativo, type Status } from "./dados";

export const MAX_TENTATIVAS = 3;
export const LIMITE_PROCESSAMENTO_MIN = 30;
const ESPERA_NOVA_TENTATIVA_MS = 10 * 60 * 1000;

export type DepsReel = {
  agora: () => Date;
  criarContainerReel: typeof criarContainerReel;
  statusContainer: typeof statusContainer;
  publicarContainer: (id: string) => Promise<{ mediaId: string; permalink?: string }>;
  travar: (id: string, de: Status[], para: Status) => Promise<Criativo | null>;
  atualizar: (id: string, patch: Partial<Criativo>) => Promise<Criativo>;
};

const padrao: DepsReel = { agora: () => new Date(), criarContainerReel, statusContainer, publicarContainer, travar, atualizar };

export type ResultadoReel = { resultado: "processando" | "aguardando" | "publicado" | "erro" | "ocupado"; criativo?: Criativo; erro?: string };

/** Erro: nova tentativa em 10 min enquanto houver tentativas; depois fica "erro". */
async function falhar(c: Criativo, msg: string, d: DepsReel, permiteNova = true): Promise<ResultadoReel> {
  const tentativas = c.tentativas + 1;
  const deNovo = permiteNova && tentativas < MAX_TENTATIVAS;
  const salvo = await d.atualizar(c.id, {
    status: deNovo ? "agendado" : "erro",
    erro: msg,
    tentativas,
    container_id: null,
    processando_desde: null,
    ...(deNovo ? { agendado_para: new Date(d.agora().getTime() + ESPERA_NOVA_TENTATIVA_MS).toISOString() } : {}),
  });
  return { resultado: "erro", criativo: salvo, erro: msg };
}

export async function iniciarReel(c: Criativo, de: Status[], d: DepsReel = padrao): Promise<ResultadoReel> {
  if (!c.video_url) {
    const salvo = await d.atualizar(c.id, { status: "erro", erro: "Reel sem vídeo montado" });
    return { resultado: "erro", criativo: salvo, erro: "Reel sem vídeo montado" };
  }
  const travado = await d.travar(c.id, de, "processando");
  if (!travado) return { resultado: "ocupado" };
  try {
    const container = await d.criarContainerReel(travado.video_url!, travado.legenda, travado.image_url);
    const salvo = await d.atualizar(c.id, { container_id: container, processando_desde: d.agora().toISOString(), erro: null });
    return { resultado: "processando", criativo: salvo };
  } catch (e) {
    return falhar(travado, e instanceof Error ? e.message : String(e), d, de.includes("agendado"));
  }
}

export async function avancarReel(c: Criativo, d: DepsReel = padrao): Promise<ResultadoReel> {
  if (c.status !== "processando" || !c.container_id) return { resultado: "ocupado" };
  try {
    const status = await d.statusContainer(c.container_id);
    if (status === "ERROR" || status === "EXPIRED") return falhar(c, `O Instagram não processou o vídeo (status ${status})`, d);
    if (status !== "FINISHED") {
      const desde = c.processando_desde ? new Date(c.processando_desde).getTime() : d.agora().getTime();
      if (d.agora().getTime() - desde > LIMITE_PROCESSAMENTO_MIN * 60_000) {
        return falhar(c, `Tempo esgotado: o Instagram ficou mais de ${LIMITE_PROCESSAMENTO_MIN} min processando o vídeo`, d);
      }
      return { resultado: "aguardando", criativo: c };
    }
    const travado = await d.travar(c.id, ["processando"], "publicando");
    if (!travado) return { resultado: "ocupado" };
    const r = await d.publicarContainer(c.container_id);
    const salvo = await d.atualizar(c.id, {
      status: "publicado",
      publicado_em: d.agora().toISOString(),
      media_id: r.mediaId,
      permalink: r.permalink ?? null,
      erro: null,
      container_id: null,
      processando_desde: null,
    });
    return { resultado: "publicado", criativo: salvo };
  } catch (e) {
    return falhar(c, e instanceof Error ? e.message : String(e), d);
  }
}
