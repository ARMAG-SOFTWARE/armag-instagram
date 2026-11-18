// GET /api/criativos/render/[id] — PNG 1080×1080 do criativo (mesma arte que vai para o Instagram, antes do JPEG).
import { NextRequest, NextResponse } from "next/server";
import { renderizarArte } from "@/lib/criativos/arte";
import { buscar } from "@/lib/criativos/dados";
import { autorizado, falha, naoAutorizado } from "@/lib/criativos/servidor";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!autorizado(req)) return naoAutorizado();
  try {
    const { id } = await params;
    const c = await buscar(id);
    if (!c) return NextResponse.json({ erro: "Criativo não encontrado" }, { status: 404 });
    const png = await renderizarArte(c);
    return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
  } catch (e) {
    return falha(e, "criativos/render");
  }
}
