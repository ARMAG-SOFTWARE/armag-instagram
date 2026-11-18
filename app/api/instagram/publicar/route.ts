// app/api/instagram/publicar/route.ts
// POST /api/instagram/publicar
//
// Aceita dois formatos:
//  a) multipart/form-data com os campos: imagem (arquivo) e legenda (texto)
//     -> converte para JPEG 1080px, sobe no Supabase Storage (bucket público) e publica
//  b) application/json: { "image_url": "https://...jpg", "legenda": "..." }
//     -> publica direto a partir de um link público
//
// Protegida pelo header:  x-api-key: <INSTAGRAM_PUBLISH_SECRET>

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { publicarImagem } from "@/lib/instagram";

export const runtime = "nodejs"; // sharp não roda no edge
export const maxDuration = 60; // o Instagram pode levar alguns segundos para processar

const BUCKET = process.env.SUPABASE_IG_BUCKET ?? "instagram";

function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

/** Converte para JPEG e ajusta a proporção para o intervalo aceito (4:5 a 1,91:1). */
async function prepararJpeg(buffer: Buffer): Promise<Buffer> {
  const img = sharp(buffer).rotate(); // respeita a orientação EXIF
  const { width = 1080, height = 1080 } = await img.metadata();
  const ratio = width / height;

  let alvoW = 1080;
  let alvoH = Math.round(1080 / ratio);
  if (ratio < 0.8) alvoH = 1350; // mais alta que 4:5 -> corta para 4:5
  if (ratio > 1.91) alvoH = 566; // mais larga que 1,91:1 -> corta para 1,91:1

  return img
    .resize(alvoW, alvoH, { fit: "cover", position: "centre" })
    .flatten({ background: "#000000" }) // remove transparência do PNG
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function subirNoStorage(jpeg: Buffer): Promise<string> {
  const supabase = supabaseAdmin();
  const caminho = `posts/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(caminho, jpeg, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(`Supabase Storage: ${error.message}`);

  return supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
}

export async function POST(req: NextRequest) {
  if (req.headers.get("x-api-key") !== process.env.INSTAGRAM_PUBLISH_SECRET) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  try {
    let imageUrl: string;
    let legenda = "";

    const tipo = req.headers.get("content-type") ?? "";

    if (tipo.includes("multipart/form-data")) {
      const form = await req.formData();
      const arquivo = form.get("imagem");
      legenda = String(form.get("legenda") ?? "");

      if (!(arquivo instanceof File)) {
        return NextResponse.json({ erro: "Envie o campo 'imagem' com um arquivo" }, { status: 400 });
      }
      if (arquivo.size > 8 * 1024 * 1024) {
        return NextResponse.json({ erro: "Imagem maior que 8 MB" }, { status: 400 });
      }

      const jpeg = await prepararJpeg(Buffer.from(await arquivo.arrayBuffer()));
      imageUrl = await subirNoStorage(jpeg);
    } else {
      const body = await req.json();
      imageUrl = body.image_url;
      legenda = body.legenda ?? "";
      if (!imageUrl) {
        return NextResponse.json({ erro: "Informe 'image_url'" }, { status: 400 });
      }
    }

    if (legenda.length > 2200) {
      return NextResponse.json({ erro: "Legenda passa de 2.200 caracteres" }, { status: 400 });
    }

    const resultado = await publicarImagem(imageUrl, legenda);
    return NextResponse.json({ ok: true, imageUrl, ...resultado });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[instagram/publicar]", msg);
    return NextResponse.json({ ok: false, erro: msg }, { status: 500 });
  }
}
