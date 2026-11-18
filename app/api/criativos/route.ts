// GET /api/criativos?status=rascunho,agendado — lista para a tela /criativos
import { NextRequest, NextResponse } from "next/server";
import { apresentar, listar, type Status } from "@/lib/criativos/dados";
import { autorizado, falha, naoAutorizado } from "@/lib/criativos/servidor";

export const runtime = "nodejs";
const VALIDOS: Status[] = ["rascunho", "agendado", "publicando", "publicado", "erro", "cancelado"];

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return naoAutorizado();
  try {
    const status = (req.nextUrl.searchParams.get("status") ?? "").split(",").filter((s): s is Status => VALIDOS.includes(s as Status));
    const limite = Math.min(100, Number(req.nextUrl.searchParams.get("limite")) || 50);
    return NextResponse.json({ criativos: (await listar(status, limite)).map(apresentar) });
  } catch (e) {
    return falha(e, "criativos/listar");
  }
}
