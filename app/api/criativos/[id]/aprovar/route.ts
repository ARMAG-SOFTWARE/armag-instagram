// POST /api/criativos/[id]/aprovar — "Pode postar": agenda para o horário do dia (fuso de São Paulo).
// Também serve para "Tentar de novo" em criativos com erro.
import { NextRequest, NextResponse } from "next/server";
import { apresentar, buscar } from "@/lib/criativos/dados";
import { agendar } from "@/lib/criativos/publicacao";
import { autorizado, falha, naoAutorizado } from "@/lib/criativos/servidor";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!autorizado(req)) return naoAutorizado();
  try {
    const { id } = await params;
    const c = await buscar(id);
    if (!c) return NextResponse.json({ erro: "Criativo não encontrado" }, { status: 404 });
    if (c.status !== "rascunho" && c.status !== "erro") return NextResponse.json({ erro: `Criativo está como ${c.status}` }, { status: 409 });
    if (c.formato === "reel" && c.status === "erro" && !c.video_url) {
      return NextResponse.json({ erro: "O vídeo deste Reel não foi montado. Use Editar textos para montar de novo." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, criativo: apresentar(await agendar(c)) });
  } catch (e) {
    return falha(e, "criativos/aprovar", 400);
  }
}
