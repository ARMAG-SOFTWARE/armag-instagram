// PATCH /api/criativos/[id] — edita os textos de um rascunho e regenera a imagem.
import { NextRequest, NextResponse } from "next/server";
import { apresentar, atualizar, buscar } from "@/lib/criativos/dados";
import { gerarJpeg, subirImagem } from "@/lib/criativos/imagem";
import { validarTexto } from "@/lib/criativos/schema";
import { autorizado, falha, naoAutorizado } from "@/lib/criativos/servidor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!autorizado(req)) return naoAutorizado();
  try {
    const { id } = await params;
    const atual = await buscar(id);
    if (!atual) return NextResponse.json({ erro: "Criativo não encontrado" }, { status: 404 });
    if (atual.status !== "rascunho") return NextResponse.json({ erro: "Só dá para editar rascunhos" }, { status: 409 });
    const corpo = (await req.json()) as Record<string, unknown>;
    const v = validarTexto({ ...atual, ...corpo, tipo: atual.tipo });
    if (!v.ok) return NextResponse.json({ erro: v.erros.join("; ") }, { status: 400 });
    const tituloPx = typeof corpo.titulo_px === "number" ? corpo.titulo_px : corpo.titulo_px === null ? null : atual.titulo_px;
    const salvo = await atualizar(id, { ...v.texto, titulo_px: tituloPx });
    const url = await subirImagem(id, await gerarJpeg(salvo));
    return NextResponse.json({ ok: true, criativo: apresentar(await atualizar(id, { image_url: url })) });
  } catch (e) {
    return falha(e, "criativos/editar");
  }
}
