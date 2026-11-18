// Renderiza a arte, converte para JPEG e sobe no Supabase Storage.
import sharp from "sharp";
import { renderizarArte, type DadosArte } from "./arte";
import { BUCKET, supabaseAdmin } from "./servidor";
import { diaSP } from "./agenda";

export async function gerarJpeg(d: DadosArte): Promise<Buffer> {
  const png = await renderizarArte(d);
  return sharp(png).flatten({ background: "#070707" }).jpeg({ quality: 90 }).toBuffer();
}

/** Sobe em criativos/AAAA-MM-DD/<id>.jpg e devolve a URL pública (com ?v= para furar o cache ao regenerar). */
export async function subirImagem(id: string, jpeg: Buffer): Promise<string> {
  const sb = supabaseAdmin();
  const caminho = `criativos/${diaSP(new Date()).data}/${id}.jpg`;
  const { error } = await sb.storage.from(BUCKET).upload(caminho, jpeg, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Supabase Storage: ${error.message}`);
  return `${sb.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl}?v=${Date.now()}`;
}
