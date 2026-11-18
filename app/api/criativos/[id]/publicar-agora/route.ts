// POST /api/criativos/[id]/publicar-agora — publica imediatamente (botão secundário, com confirmação na tela).
import { NextRequest, NextResponse } from "next/server";
import { apresentar, buscar } from "@/lib/criativos/dados";
import { publicarComTrava } from "@/lib/criativos/publicacao";
import { iniciarReel } from "@/lib/criativos/reel";
import { autorizado, falha, naoAutorizado } from "@/lib/criativos/servidor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!autorizado(req)) return naoAutorizado();
  try {
    const { id } = await params;
    const c = await buscar(id);
    if (!c) return NextResponse.json({ erro: "Criativo não encontrado" }, { status: 404 });
    if (c.formato === "reel") {
      // Reel: envia agora; o cron publica quando o Instagram terminar de processar (alguns minutos)
      const r = await iniciarReel(c, ["rascunho", "agendado", "erro"]);
      if (r.resultado === "ocupado") return NextResponse.json({ erro: "Este Reel já está sendo publicado ou já foi." }, { status: 409 });
      const ok = r.resultado === "processando";
      return NextResponse.json(
        { ok, processando: ok, erro: r.erro, criativo: r.criativo && apresentar(r.criativo) },
        { status: ok ? 200 : 502 },
      );
    }
    const r = await publicarComTrava(c, ["rascunho", "agendado", "erro"]);
    if (r.resultado === "ocupado") return NextResponse.json({ erro: "Este criativo já está sendo publicado ou já foi." }, { status: 409 });
    return NextResponse.json({ ok: r.resultado === "publicado", erro: r.erro, criativo: r.criativo && apresentar(r.criativo) }, { status: r.resultado === "publicado" ? 200 : 502 });
  } catch (e) {
    return falha(e, "criativos/publicar-agora");
  }
}
