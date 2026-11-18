// Texto do criativo do dia gerado pela API da Anthropic, seguindo criativos/PADRAO.md.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { formatarAgendado } from "./agenda";
import { TIPOS, validarTexto, type TextoCriativo, type Tipo } from "./schema";

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

Nunca invente números, porcentagens, clientes, depoimentos, prêmios, prazos ou preços.
Português do Brasil, com acentos corretos.`;

export async function gerarTexto(opts: { tipo: Tipo; temasRecentes: string[]; agora?: Date; client?: Anthropic }): Promise<TextoCriativo> {
  const client = opts.client ?? new Anthropic();
  const system = `${await lerPadrao()}\n\n---\n${REGRAS}`;
  const pedido = [
    `Tipo de hoje: ${opts.tipo}.`,
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
    if (v.ok) return v.texto;
    ultimoErro = v.erros.join("; ");
    // pede a correção mantendo a conversa (sem editar o histórico)
    mensagens.push({ role: "assistant", content: r.content });
    mensagens.push({ role: "user", content: `O JSON não passou na validação: ${ultimoErro}. Corrija e responda de novo com o JSON completo.` });
  }
  throw new Error(`Não consegui gerar um texto válido: ${ultimoErro}`);
}
