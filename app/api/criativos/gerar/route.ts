// POST /api/criativos/gerar — gera texto (Claude) e a arte (imagem) ou dispara a montagem do vídeo (reel).
// Corpo opcional: { "descartar_id": "<rascunho atual>", "formato": "imagem" | "reel" }.
// Sem formato, usa o do próximo dia livre em Horários de postagem.
import { NextRequest, NextResponse } from "next/server";
import { diaSP, proximoFormato, type Formato } from "@/lib/criativos/agenda";
import { agendadosFuturos, apresentar, atualizar, buscar, historicoParaGerar, horarios, inserir } from "@/lib/criativos/dados";
import { gerarTexto, proximoTipo } from "@/lib/criativos/gerar-texto";
import { dispararRender } from "@/lib/criativos/github";
import { gerarJpeg, subirImagem } from "@/lib/criativos/imagem";
import { autorizado, falha, naoAutorizado } from "@/lib/criativos/servidor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return naoAutorizado();
  try {
    const corpo = (await req.json().catch(() => ({}))) as { descartar_id?: string; formato?: Formato };
    if (corpo.descartar_id) {
      const atual = await buscar(corpo.descartar_id);
      if (atual && (atual.status === "rascunho" || atual.status === "renderizando")) await atualizar(atual.id, { status: "cancelado" });
    }
    let formato: Formato;
    if (corpo.formato === "imagem" || corpo.formato === "reel") formato = corpo.formato;
    else {
      const ocupados = new Set((await agendadosFuturos()).map((x) => diaSP(new Date(x.agendado_para!)).data));
      formato = proximoFormato(new Date(), await horarios(), ocupados);
    }

    const { ultimoTipo, temas } = await historicoParaGerar();
    const texto = await gerarTexto({ tipo: proximoTipo(ultimoTipo), formato, temasRecentes: temas });
    const novo = await inserir({ ...texto, titulo_px: null, formato }, formato === "reel" ? "renderizando" : "rascunho");

    if (formato === "reel") {
      try {
        await dispararRender(novo.id);
      } catch (e) {
        const salvo = await atualizar(novo.id, { status: "erro", erro: e instanceof Error ? e.message : String(e) });
        return NextResponse.json({ ok: false, erro: salvo.erro, criativo: apresentar(salvo) }, { status: 502 });
      }
      return NextResponse.json({ ok: true, criativo: apresentar(novo) });
    }

    const url = await subirImagem(novo.id, await gerarJpeg(novo));
    return NextResponse.json({ ok: true, criativo: apresentar(await atualizar(novo.id, { image_url: url })) });
  } catch (e) {
    return falha(e, "criativos/gerar");
  }
}
