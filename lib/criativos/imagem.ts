// Renderiza a arte, converte para JPEG e sobe no Supabase Storage.
import sharp from "sharp";
import { renderizarArte, type DadosArte } from "./arte";
import { renderizarCarrossel, type DadosCarrossel } from "./carrossel";
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

/** Slides do carrossel em JPEG (1080×1350), na ordem. */
export async function gerarCarrossel(d: DadosCarrossel): Promise<Buffer[]> {
  const pngs = await renderizarCarrossel(d);
  return Promise.all(pngs.map((png) => sharp(png).flatten({ background: "#070707" }).jpeg({ quality: 90 }).toBuffer()));
}

/** Sobe cada slide em criativos/AAAA-MM-DD/<id>-NN.jpg e devolve as URLs públicas na ordem. */
export async function subirSlides(id: string, jpegs: Buffer[]): Promise<string[]> {
  const sb = supabaseAdmin();
  const dia = diaSP(new Date()).data;
  const v = Date.now();
  const urls: string[] = [];
  for (const [i, jpeg] of jpegs.entries()) {
    const caminho = `criativos/${dia}/${id}-${String(i + 1).padStart(2, "0")}.jpg`;
    const { error } = await sb.storage.from(BUCKET).upload(caminho, jpeg, { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(`Supabase Storage: ${error.message}`);
    urls.push(`${sb.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl}?v=${v}`);
  }
  return urls;
}
