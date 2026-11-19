// Texto do criativo do dia gerado pela API da Anthropic, seguindo criativos/PADRAO.md.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { formatarAgendado } from "./agenda";
import { normalizarSlides, TIPOS, validarRoteiro, validarSlides, validarTexto, type Slide, type TextoCriativo, type Tipo } from "./schema";
import type { Formato } from "./agenda";

const MODELO = "claude-sonnet-5-5";
const TENTATIVAS = 3; // 1 + 2 novas tentativas se a validação falhar

// Formato pedido ao modelo (os limites finos são conferidos depois por validarTexto).
const Formato = z.object({
  tipo: z.enum(TIPOS),
  titulo: z.string(),
  subtitulo: z.string(),
  itens: z.array(z.string()),
  cta: z.string(),
  legenda: z.string(),
  tema: z.string(),
  roteiro: z.string(),
  slides: z.array(z.object({ titulo: z.string(), texto: z.string() })),
});

let padrao: Promise<string> | null = null;
const lerPadrao = () => (padrao ??= readFile(path.join(process.cwd(), "criativos", "PADRAO.md"), "utf8"));

/** Alterna em relação ao último publicado/agendado; sem histórico começa por "Serviço". */
export const proximoTipo = (ultimo: Tipo | null): Tipo => (ultimo === "Serviço" ? "Dica" : "Serviço");

const REGRAS = `
Você escreve o criativo do dia do Instagram @armag.soft seguindo À RISCA o padrão acima.

Responda somente com o JSON pedido:
- tipo: "Serviço" ou "Dica" (use o tipo indicado na mensagem)
- titulo: até 40 caracteres, frase de impacto
- subtitulo: 1 a 2 frases, até 110 caracteres
- itens: 0 a 4 tópicos, cada um até 35 caracteres
- cta: curto, coerente com o tipo (Serviço → contato · link na bio; Dica → salvar / seguir @armag.soft)
- legenda: os 4 blocos do padrão separados por linha em branco, até 2.200 caracteres, terminando com 5 a 8 hashtags em que a PRIMEIRA é #armag
- tema: resumo curto (3 a 8 palavras) do assunto, para não repetir no futuro

- roteiro: SÓ quando o formato for "reel" (senão devolva ""). Texto que a voz vai narrar no Reel, de 25 a 40 palavras (12 a 15 segundos).
  Comece pelo gancho (a dor ou a curiosidade), explique em 1 ou 2 frases curtas e termine com a chamada falada
  (Serviço: "Chama no direct ou toca no link da bio."; Dica: "Salva esse vídeo e segue a ARMAG.").
  Frases curtas, linguagem falada, números por extenso, sem hashtags, sem emojis e sem siglas difíceis de ler em voz alta.

- slides: SÓ quando o formato for "carrossel" (senão devolva []). De 3 a 5 slides de conteúdo, um ponto por slide:
  titulo até 45 caracteres e texto até 160 caracteres (1 ou 2 frases curtas). O título e o subtítulo viram a capa
  e o CTA vira o último slide, então NÃO repita a capa nem o CTA dentro de slides. Os itens podem ficar vazios no carrossel.

Nunca invente números, porcentagens, clientes, depoimentos, prêmios, prazos ou preços.
Português do Brasil, com acentos corretos.`;

export type TextoGerado = TextoCriativo & { roteiro: string | null; slides: Slide[] };

export async function gerarTexto(opts: { tipo: Tipo; formato?: Formato; temasRecentes: string[]; agora?: Date; client?: Anthropic }): Promise<TextoGerado> {
  const formato = opts.formato ?? "imagem";
  const client = opts.client ?? new Anthropic();
  const system = `${await lerPadrao()}\n\n---\n${REGRAS}`;
  const pedido = [
    `Tipo de hoje: ${opts.tipo}.`,
    `Formato: ${
      formato === "reel"
        ? "reel (vídeo vertical narrado; escreva também o roteiro; slides vazio)"
        : formato === "carrossel"
          ? "carrossel (escreva de 3 a 5 slides de conteúdo; roteiro vazio)"
          : "imagem (roteiro vazio e slides vazio)"
    }.`,
    `Hoje é ${formatarAgendado(opts.agora ?? new Date()).split(" às ")[0]}.`,
    opts.temasRecentes.length
      ? `Temas já usados (NÃO repita nenhum deles nem algo muito parecido):\n${opts.temasRecentes.map((t) => `- ${t}`).join("\n")}`
      : "Ainda não há posts anteriores.",
  ].join("\n\n");

  const mensagens: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: pedido }];
  let ultimoErro = "";
  for (let i = 0; i < TENTATIVAS; i++) {
    const r = await client.beta.messages.parse({
      model: MODELO,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // se o modelo recusar por política, a API tenta o modelo reserva na mesma chamada
      system,
      messages: mensagens,
      output_config: { effort: "medium", format: betaZodOutputFormat(Formato) },
    });
    if (r.stop_reason === "refusal") throw new Error("O modelo recusou gerar este criativo. Tente de novo.");
    const dados = r.parsed_output;
    const v = validarTexto(dados ? { ...dados, tipo: opts.tipo } : null);
    const erroRoteiro = formato === "reel" ? validarRoteiro(dados?.roteiro) : null;
    const erroSlides = formato === "carrossel" ? validarSlides(dados?.slides) : null;
    if (v.ok && !erroRoteiro && !erroSlides) {
      return {
        ...v.texto,
        roteiro: formato === "reel" ? dados!.roteiro.trim() : null,
        slides: formato === "carrossel" ? normalizarSlides(dados!.slides) : [],
      };
    }
    ultimoErro = [...(v.ok ? [] : v.erros), ...(erroRoteiro ? [erroRoteiro] : []), ...(erroSlides ? [erroSlides] : [])].join("; ");
    // pede a correção mantendo a conversa (sem editar o histórico)
    mensagens.push({ role: "assistant", content: r.content });
    mensagens.push({ role: "user", content: `O JSON não passou na validação: ${ultimoErro}. Corrija e responda de novo com o JSON completo.` });
  }
  throw new Error(`Não consegui gerar um texto válido: ${ultimoErro}`);
}
