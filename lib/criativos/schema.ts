// Regras do texto de um criativo (criativos/PADRAO.md).
import { z } from "zod";

export const TIPOS = ["Serviço", "Dica"] as const;
export type Tipo = (typeof TIPOS)[number];

export const hashtags = (texto: string) => texto.match(/#[\p{L}\p{N}_]+/gu) ?? [];
const tamanho = (s: string) => [...s].length;

export const TextoCriativo = z.object({
  tipo: z.enum(TIPOS, { message: "tipo: use \"Serviço\" ou \"Dica\"" }),
  titulo: z.string().trim().min(1).refine((s) => tamanho(s) <= 40, "titulo: até 40 caracteres"),
  subtitulo: z.string().trim().min(1).refine((s) => tamanho(s) <= 110, "subtitulo: até 110 caracteres"),
  itens: z
    .array(z.string().trim().min(1).refine((s) => tamanho(s) <= 35, "itens: cada um até 35 caracteres"))
    .max(4, "itens: no máximo 4"),
  cta: z.string().trim().min(1).refine((s) => tamanho(s) <= 60, "cta: até 60 caracteres"),
  legenda: z
    .string()
    .trim()
    .min(1)
    .refine((s) => tamanho(s) <= 2200, "legenda: até 2.200 caracteres")
    .refine((s) => {
      const n = hashtags(s).length;
      return n >= 5 && n <= 8;
    }, "legenda: use de 5 a 8 hashtags")
    .refine((s) => hashtags(s)[0]?.toLowerCase() === "#armag", "legenda: as hashtags devem começar por #armag"),
  tema: z.string().trim().min(3).max(120),
});
export type TextoCriativo = z.infer<typeof TextoCriativo>;

/** Valida e devolve o texto normalizado ou a lista de erros (em português). */
export function validarTexto(dados: unknown): { ok: true; texto: TextoCriativo } | { ok: false; erros: string[] } {
  const r = TextoCriativo.safeParse(dados);
  if (r.success) return { ok: true, texto: r.data };
  return { ok: false, erros: r.error.issues.map((i) => (i.message.includes(":") ? i.message : `${i.path.join(".")}: ${i.message}`)) };
}

/** Palavras faladas (ignora pontuação). */
export const contarPalavras = (texto: string) => (texto.match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu) ?? []).length;

export const ROTEIRO_MIN = 25;
export const ROTEIRO_MAX = 40;

/** Roteiro narrado do Reel: 25 a 40 palavras (~12–15 s). Devolve a mensagem de erro ou null. */
export function validarRoteiro(texto: string | null | undefined): string | null {
  const n = contarPalavras(texto ?? "");
  if (n < ROTEIRO_MIN || n > ROTEIRO_MAX) return `roteiro: use de ${ROTEIRO_MIN} a ${ROTEIRO_MAX} palavras (tem ${n})`;
  return null;
}

export type Slide = { titulo: string; texto: string };
export const SLIDES_MIN = 3;
export const SLIDES_MAX = 5;
export const SLIDE_TITULO_MAX = 45;
export const SLIDE_TEXTO_MAX = 160;

/** Slides de conteúdo do carrossel (a capa usa título/subtítulo e o último slide usa o CTA). Devolve o erro ou null. */
export function validarSlides(slides: unknown): string | null {
  if (!Array.isArray(slides) || slides.length < SLIDES_MIN || slides.length > SLIDES_MAX) {
    return `slides: use de ${SLIDES_MIN} a ${SLIDES_MAX} slides de conteúdo (tem ${Array.isArray(slides) ? slides.length : 0})`;
  }
  for (const [i, sl] of slides.entries()) {
    const t = String((sl as Slide)?.titulo ?? "").trim();
    const x = String((sl as Slide)?.texto ?? "").trim();
    if (!t || tamanho(t) > SLIDE_TITULO_MAX) return `slides: título do slide ${i + 1} deve ter de 1 a ${SLIDE_TITULO_MAX} caracteres`;
    if (tamanho(x) > SLIDE_TEXTO_MAX) return `slides: texto do slide ${i + 1} deve ter até ${SLIDE_TEXTO_MAX} caracteres`;
  }
  return null;
}

export const normalizarSlides = (slides: Slide[]): Slide[] => slides.map((s) => ({ titulo: s.titulo.trim(), texto: (s.texto ?? "").trim() }));
