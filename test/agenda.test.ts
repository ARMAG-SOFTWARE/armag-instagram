import { describe, expect, it } from "vitest";
import { calcularAgendamento, diaSP, formatarAgendado, paraUtcSP, type Horario } from "@/lib/criativos/agenda";

// 0=domingo ... 6=sábado (valores iniciais da migration)
const PADRAO: Horario[] = [
  { dia_semana: 0, hora: "10:00", ativo: false },
  { dia_semana: 1, hora: "12:00", ativo: true },
  { dia_semana: 2, hora: "12:00", ativo: true },
  { dia_semana: 3, hora: "12:00", ativo: true },
  { dia_semana: 4, hora: "12:00", ativo: true },
  { dia_semana: 5, hora: "12:00", ativo: true },
  { dia_semana: 6, hora: "10:00", ativo: true },
];
const iso = (d: Date | null) => d?.toISOString() ?? null;

describe("fuso de São Paulo", () => {
  it("converte horário local de SP para UTC (UTC−3)", () => {
    expect(paraUtcSP("2026-11-18", "12:00").toISOString()).toBe("2026-11-18T15:00:00.000Z");
  });
  it("dia em SP difere do dia em UTC perto da meia-noite", () => {
    expect(diaSP(new Date("2026-11-19T02:30:00Z"))).toEqual({ data: "2026-11-18", diaSemana: 3, hora: "23:30" });
  });
});

describe("calcularAgendamento", () => {
  it("hoje ativo e horário ainda não passou → hoje", () => {
    // quarta 18/11/2026 09:00 em SP
    expect(iso(calcularAgendamento(new Date("2026-11-18T12:00:00Z"), PADRAO, new Set()))).toBe("2026-11-18T15:00:00.000Z");
  });
  it("horário de hoje já passou → próximo dia ativo", () => {
    // quarta 18/11 13:00 em SP → quinta 12:00
    expect(iso(calcularAgendamento(new Date("2026-11-18T16:00:00Z"), PADRAO, new Set()))).toBe("2026-11-19T15:00:00.000Z");
  });
  it("exatamente no horário conta como passado", () => {
    expect(iso(calcularAgendamento(new Date("2026-11-18T15:00:00Z"), PADRAO, new Set()))).toBe("2026-11-19T15:00:00.000Z");
  });
  it("pula dia inativo (sábado 21/11 depois das 10h → domingo inativo → segunda)", () => {
    expect(iso(calcularAgendamento(new Date("2026-11-21T14:00:00Z"), PADRAO, new Set()))).toBe("2026-11-23T15:00:00.000Z");
  });
  it("dia já ocupado por outro agendado → próximo dia ativo livre", () => {
    const ocupados = new Set(["2026-11-18", "2026-11-19"]);
    expect(iso(calcularAgendamento(new Date("2026-11-18T12:00:00Z"), PADRAO, ocupados))).toBe("2026-11-20T15:00:00.000Z");
  });
  it("nenhum dia ativo → null", () => {
    expect(calcularAgendamento(new Date(), PADRAO.map((h) => ({ ...h, ativo: false })), new Set())).toBeNull();
  });
  it("aceita hora no formato do Postgres (HH:MM:SS)", () => {
    const h = PADRAO.map((x) => ({ ...x, hora: x.hora + ":00" }));
    expect(iso(calcularAgendamento(new Date("2026-11-18T12:00:00Z"), h, new Set()))).toBe("2026-11-18T15:00:00.000Z");
  });
});

describe("formatarAgendado", () => {
  it("texto em português no fuso de SP", () => {
    expect(formatarAgendado(new Date("2026-11-18T15:00:00Z"))).toBe("quarta, 18/11 às 12:00");
    expect(formatarAgendado(new Date("2026-11-21T13:00:00Z"))).toBe("sábado, 21/11 às 10:00");
  });
});
