// PATCH /api/criativos/[id] — edita os textos de um rascunho e regenera a imagem (ou remonta o vídeo do reel).
import { NextRequest, NextResponse } from "next/server";
import { apresentar, atualizar, buscar } from "@/lib/criativos/dados";
import { dispararRender } from "@/lib/criativos/github";
import { gerarCarrossel, gerarJpeg, subirImagem, subirSlides } from "@/lib/criativos/imagem";
import { normalizarSlides, validarRoteiro, validarSlides, validarTexto, type Slide } from "@/lib/criativos/schema";
import { autorizado, falha, naoAutorizado } from "@/lib/criativos/servidor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!autorizado(req)) return naoAutorizado();
  try {
    const { id } = await params;
    const atual = await buscar(id);
    if (!atual) return NextResponse.json({ erro: "Criativo não encontrado" }, { status: 404 });
    const editavel = atual.status === "rascunho" || (atual.formato === "reel" && atual.status === "erro" && !atual.video_url);
    if (!editavel) return NextResponse.json({ erro: "Só dá para editar rascunhos" }, { status: 409 });
    const corpo = (await req.json()) as Record<string, unknown>;
    const v = validarTexto({ ...atual, ...corpo, tipo: atual.tipo });
    if (!v.ok) return NextResponse.json({ erro: v.erros.join("; ") }, { status: 400 });
    const tituloPx = typeof corpo.titulo_px === "number" ? corpo.titulo_px : corpo.titulo_px === null ? null : atual.titulo_px;

    if (atual.formato === "reel") {
      const roteiro = typeof corpo.roteiro === "string" ? corpo.roteiro.trim() : atual.roteiro ?? "";
      const erroRoteiro = validarRoteiro(roteiro);
      if (erroRoteiro) return NextResponse.json({ erro: erroRoteiro }, { status: 400 });
      const salvo = await atualizar(id, { ...v.texto, titulo_px: tituloPx, roteiro, status: "renderizando", erro: null });
      try {
        await dispararRender(id);
      } catch (e) {
        const comErro = await atualizar(id, { status: "erro", erro: e instanceof Error ? e.message : String(e) });
        return NextResponse.json({ ok: false, erro: comErro.erro, criativo: apresentar(comErro) }, { status: 502 });
      }
      return NextResponse.json({ ok: true, criativo: apresentar(salvo) });
    }

    if (atual.formato === "carrossel") {
      const slides = Array.isArray(corpo.slides) ? (corpo.slides as Slide[]) : atual.slides;
      const erroSlides = validarSlides(slides);
      if (erroSlides) return NextResponse.json({ erro: erroSlides }, { status: 400 });
      const salvo = await atualizar(id, { ...v.texto, titulo_px: tituloPx, slides: normalizarSlides(slides) });
      const urls = await subirSlides(id, await gerarCarrossel(salvo));
      return NextResponse.json({ ok: true, criativo: apresentar(await atualizar(id, { imagens: urls, image_url: urls[0] })) });
    }

    const salvo = await atualizar(id, { ...v.texto, titulo_px: tituloPx });
    const url = await subirImagem(id, await gerarJpeg(salvo));
    return NextResponse.json({ ok: true, criativo: apresentar(await atualizar(id, { image_url: url })) });
  } catch (e) {
    return falha(e, "criativos/editar");
  }
}
