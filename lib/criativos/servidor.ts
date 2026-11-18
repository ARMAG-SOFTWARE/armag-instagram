// Utilidades de servidor das rotas de criativos. Nunca importe isto em componentes "use client".
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";

export const BUCKET = process.env.SUPABASE_IG_BUCKET ?? "instagram";

export function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

function igual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Header x-api-key = INSTAGRAM_PUBLISH_SECRET (mesma chave da tela de publicação). */
export function autorizado(req: NextRequest): boolean {
  const segredo = process.env.INSTAGRAM_PUBLISH_SECRET;
  const chave = req.headers.get("x-api-key");
  return !!segredo && !!chave && igual(chave, segredo);
}

/** Authorization: Bearer CRON_SECRET (chamado pelo pg_cron). */
export function cronAutorizado(req: NextRequest): boolean {
  const segredo = process.env.CRON_SECRET;
  const h = req.headers.get("authorization") ?? "";
  return !!segredo && igual(h, `Bearer ${segredo}`);
}

export const naoAutorizado = () => NextResponse.json({ erro: "Não autorizado" }, { status: 401 });

export function falha(e: unknown, onde: string, status = 500) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`[${onde}]`, msg);
  return NextResponse.json({ ok: false, erro: msg }, { status });
}
