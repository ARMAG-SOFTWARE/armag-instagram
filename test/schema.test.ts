import { describe, expect, it } from "vitest";
import { validarTexto } from "@/lib/criativos/schema";
import { tamanhoTitulo } from "@/lib/criativos/titulo";

const ok = {
  tipo: "Serviço",
  titulo: "Seu negócio no controle",
  subtitulo: "Sistema de gestão sob medida: vendas, estoque, financeiro e cobrança em um só lugar.",
  itens: ["Vendas e estoque integrados", "Acesso pelo celular"],
  cta: "Peça uma demonstração · link na bio",
  legenda: "Gancho. 📉\n\nTexto.\n\nChama no direct. 👑\n\n#armag #sistemadegestao #pequenosnegocios #automacao #software",
  tema: "sistema de gestão sob medida",
};

describe("validarTexto", () => {
  it("aceita o modelo aprovado", () => expect(validarTexto(ok).ok).toBe(true));
  const erro = (patch: Record<string, unknown>) => {
    const r = validarTexto({ ...ok, ...patch });
    return r.ok ? "" : r.erros.join(" | ");
  };
  it("título acima de 40 caracteres", () => expect(erro({ titulo: "x".repeat(41) })).toMatch(/titulo/));
  it("subtítulo acima de 110", () => expect(erro({ subtitulo: "x".repeat(111) })).toMatch(/subtitulo/));
  it("mais de 4 itens ou item acima de 35", () => {
    expect(erro({ itens: ["a", "b", "c", "d", "e"] })).toMatch(/itens/);
    expect(erro({ itens: ["x".repeat(36)] })).toMatch(/itens/);
  });
  it("hashtags: 5 a 8 e começando por #armag", () => {
    expect(erro({ legenda: "Oi\n\n#armag #a #b #c" })).toMatch(/hashtags/);
    expect(erro({ legenda: "Oi\n\n#a #armag #b #c #d" })).toMatch(/#armag/);
    expect(erro({ legenda: "Oi\n\n#armag #a #b #c #d #e #f #g #h" })).toMatch(/hashtags/);
  });
  it("legenda acima de 2200 caracteres (emoji conta 1)", () => {
    const base = ok.legenda;
    expect(erro({ legenda: "🚀".repeat(2200 - [...base].length) + base })).toBe("");
    expect(erro({ legenda: "🚀".repeat(2201 - [...base].length) + base })).toMatch(/legenda/);
  });
  it("tipo inválido", () => expect(erro({ tipo: "Promo" })).toMatch(/tipo/));
});

describe("tamanhoTitulo", () => {
  it("usa titulo_px quando informado", () => expect(tamanhoTitulo("Qualquer", 60)).toBe(60));
  it("título curto fica em 76px", () => expect(tamanhoTitulo("Seu negócio no controle")).toBe(76));
  it("título longo diminui", () => expect(tamanhoTitulo("Controle financeiro simples para pequenos negócios")).toBeLessThan(76));
  it("nunca abaixo de 44px", () => expect(tamanhoTitulo("x".repeat(200))).toBeGreaterThanOrEqual(44));
});
