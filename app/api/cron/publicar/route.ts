// GET /api/cron/publicar — publica os criativos agendados vencidos.
// Chamado a cada 5 min pelo pg_cron do Supabase (supabase/migrations/0002_criativos_cron.sql).
// Protegido por Authorization: Bearer CRON_SECRET.
import { NextRequest, NextResponse } from "next/server";
import { vencidos } from "@/lib/criativos/dados";
import { publicarComTrava } from "@/lib/criativos/publicacao";
import { cronAutorizado, falha, naoAutorizado } from "@/lib/criativos/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return naoAutorizado();
  try {
    const resumo: { id: string; titulo: string; resultado: string; permalink?: string | null; erro?: string }[] = [];
    for (const c of await vencidos(new Date())) {
      const r = await publicarComTrava(c, ["agendado"]);
      resumo.push({ id: c.id, titulo: c.titulo, resultado: r.resultado, permalink: r.criativo?.permalink, erro: r.erro });
    }
    return NextResponse.json({ ok: true, processados: resumo.length, resumo });
  } catch (e) {
    return falha(e, "cron/publicar");
  }
}
