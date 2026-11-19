// GET /api/cron/publicar — publica os criativos agendados vencidos.
// Chamado a cada 5 min pelo pg_cron do Supabase (supabase/migrations/0002_criativos_cron.sql).
// Imagens: publica na hora. Reels: etapa 1 (cria o container) e, nas chamadas seguintes, etapa 2 (publica quando o Instagram termina).
// Protegido por Authorization: Bearer CRON_SECRET.
import { NextRequest, NextResponse } from "next/server";
import { emProcessamento, vencidos } from "@/lib/criativos/dados";
import { publicarComTrava } from "@/lib/criativos/publicacao";
import { avancarReel, iniciarReel } from "@/lib/criativos/reel";
import { cronAutorizado, falha, naoAutorizado } from "@/lib/criativos/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return naoAutorizado();
  try {
    const resumo: { id: string; titulo: string; formato: string; resultado: string; permalink?: string | null; erro?: string }[] = [];
    // etapa 2 primeiro: Reels que o Instagram já pode ter terminado de processar
    for (const c of await emProcessamento()) {
      const r = await avancarReel(c);
      resumo.push({ id: c.id, titulo: c.titulo, formato: "reel", resultado: r.resultado, permalink: r.criativo?.permalink, erro: r.erro });
    }
    for (const c of await vencidos(new Date())) {
      const r = c.formato === "reel" ? await iniciarReel(c, ["agendado"]) : await publicarComTrava(c, ["agendado"]);
      resumo.push({ id: c.id, titulo: c.titulo, formato: c.formato, resultado: r.resultado, permalink: r.criativo?.permalink, erro: r.erro });
    }
    return NextResponse.json({ ok: true, processados: resumo.length, resumo });
  } catch (e) {
    return falha(e, "cron/publicar");
  }
}
