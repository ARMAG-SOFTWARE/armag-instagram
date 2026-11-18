// POST /api/criativos/gerar — gera texto (Claude) + imagem e grava como rascunho.
// Corpo opcional: { "descartar_id": "<id do rascunho atual>" } para o botão "Gerar outro".
import { NextRequest, NextResponse } from "next/server";
import { apresentar, atualizar, buscar, historicoParaGerar, inserir } from "@/lib/criativos/dados";
import { gerarTexto, proximoTipo } from "@/lib/criativos/gerar-texto";
import { gerarJpeg, subirImagem } from "@/lib/criativos/imagem";
import { autorizado, falha, naoAutorizado } from "@/lib/criativos/servidor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return naoAutorizado();
  try {
    const corpo = (await req.json().catch(() => ({}))) as { descartar_id?: string };
    if (corpo.descartar_id) {
      const atual = await buscar(corpo.descartar_id);
      if (atual?.status === "rascunho") await atualizar(atual.id, { status: "cancelado" });
    }
    const { ultimoTipo, temas } = await historicoParaGerar();
    const texto = await gerarTexto({ tipo: proximoTipo(ultimoTipo), temasRecentes: temas });
    const novo = await inserir({ ...texto, titulo_px: null });
    const url = await subirImagem(novo.id, await gerarJpeg(novo));
    return NextResponse.json({ ok: true, criativo: apresentar(await atualizar(novo.id, { image_url: url })) });
  } catch (e) {
    return falha(e, "criativos/gerar");
  }
}
