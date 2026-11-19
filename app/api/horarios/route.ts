// GET/PUT /api/horarios — horários de postagem por dia da semana (0=domingo … 6=sábado).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { horarios, salvarHorarios } from "@/lib/criativos/dados";
import { autorizado, falha, naoAutorizado } from "@/lib/criativos/servidor";

export const runtime = "nodejs";

const Lista = z
  .array(z.object({
      dia_semana: z.number().int().min(0).max(6),
      hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/),
      ativo: z.boolean(),
      formato: z.enum(["imagem", "carrossel", "reel"]).default("imagem"),
    }))
  .min(1)
  .max(7);

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return naoAutorizado();
  try {
    return NextResponse.json({ horarios: await horarios() });
  } catch (e) {
    return falha(e, "horarios/ler");
  }
}

export async function PUT(req: NextRequest) {
  if (!autorizado(req)) return naoAutorizado();
  try {
    const r = Lista.safeParse((await req.json())?.horarios);
    if (!r.success) return NextResponse.json({ erro: "Horários inválidos (use HH:MM e dias de 0 a 6)" }, { status: 400 });
    await salvarHorarios(r.data.map((h) => ({ ...h, hora: h.hora.slice(0, 5) })));
    return NextResponse.json({ ok: true, horarios: await horarios() });
  } catch (e) {
    return falha(e, "horarios/salvar");
  }
}
