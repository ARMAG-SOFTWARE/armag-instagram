// Agendar e publicar criativos (usado pelas rotas "Pode postar", "Publicar agora" e pelo cron).
import { publicarImagem } from "@/lib/instagram";
import { calcularAgendamento, diaSP } from "./agenda";
import { agendadosFuturos, atualizar, horarios, travar, type Criativo, type Status } from "./dados";

export const MAX_TENTATIVAS = 3;
const ESPERA_NOVA_TENTATIVA_MS = 10 * 60 * 1000;

/** Calcula o horário (fuso de SP) e marca como agendado. */
export async function agendar(c: Criativo, agora = new Date()): Promise<Criativo> {
  if (c.formato === "reel" && !c.video_url) throw new Error("O vídeo deste Reel ainda não foi montado.");
  if (!c.image_url) throw new Error("Este criativo ainda não tem imagem.");
  const ocupados = new Set((await agendadosFuturos(c.id)).map((x) => diaSP(new Date(x.agendado_para!)).data));
  const quando = calcularAgendamento(agora, await horarios(), ocupados, c.formato ?? "imagem");
  if (!quando) {
    throw new Error(
      c.formato === "reel"
        ? "Nenhum dia ativo marcado como Reel. Marque pelo menos um dia como Reel em Horários de postagem."
        : "Nenhum dia ativo marcado como Imagem. Ative pelo menos um dia de Imagem em Horários de postagem.",
    );
  }
  const travado = await travar(c.id, ["rascunho", "erro"], "agendado");
  if (!travado) throw new Error("Este criativo não está mais como rascunho.");
  return atualizar(c.id, { agendado_para: quando.toISOString(), erro: null, tentativas: 0 });
}

/**
 * Publica com trava: só um processo consegue passar o status para "publicando".
 * Em erro: volta para "agendado" daqui a 10 min enquanto houver tentativas; depois fica "erro".
 */
export async function publicarComTrava(c: Criativo, de: Status[]): Promise<{ resultado: "publicado" | "erro" | "ocupado"; criativo?: Criativo; erro?: string }> {
  if (c.formato === "reel") throw new Error("Reels são publicados por iniciarReel/avancarReel");
  const travado = await travar(c.id, de, "publicando");
  if (!travado) return { resultado: "ocupado" };
  try {
    if (!travado.image_url) throw new Error("Criativo sem imagem");
    // a URL tem ?v= só para furar cache do navegador; o Instagram recebe o mesmo arquivo
    const r = await publicarImagem(travado.image_url, travado.legenda);
    const pronto = await atualizar(c.id, {
      status: "publicado",
      publicado_em: new Date().toISOString(),
      media_id: r.mediaId,
      permalink: r.permalink ?? null,
      erro: null,
    });
    return { resultado: "publicado", criativo: pronto };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const tentativas = travado.tentativas + 1;
    const deNovo = tentativas < MAX_TENTATIVAS && de.includes("agendado");
    const salvo = await atualizar(c.id, {
      status: deNovo ? "agendado" : "erro",
      erro: msg,
      tentativas,
      ...(deNovo ? { agendado_para: new Date(Date.now() + ESPERA_NOVA_TENTATIVA_MS).toISOString() } : {}),
    });
    return { resultado: "erro", criativo: salvo, erro: msg };
  }
}
