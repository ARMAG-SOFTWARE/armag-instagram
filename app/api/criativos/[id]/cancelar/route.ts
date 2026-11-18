// POST /api/criativos/[id]/cancelar — tira do agendamento. Corpo opcional { "descartar": true } → "cancelado"; senão volta a rascunho.
import { NextRequest, NextResponse } from "next/server";
import { apresentar, atualizar, travar } from "@/lib/criativos/dados";
import { autorizado, falha, naoAutorizado } from "@/lib/criativos/servidor";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!autorizado(req)) return naoAutorizado();
  try {
    const { id } = await params;
    const corpo = (await req.json().catch(() => ({}))) as { descartar?: boolean };
    const para = corpo.descartar ? "cancelado" : "rascunho";
    const c = await travar(id, ["agendado", ...(corpo.descartar ? (["rascunho", "erro"] as const) : [])], para);
    if (!c) return NextResponse.json({ erro: "Este criativo não está agendado (pode já ter sido publicado)." }, { status: 409 });
    return NextResponse.json({ ok: true, criativo: apresentar(await atualizar(id, { agendado_para: null })) });
  } catch (e) {
    return falha(e, "criativos/cancelar");
  }
}
