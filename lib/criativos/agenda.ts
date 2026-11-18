// Agendamento dos criativos — sempre no fuso de São Paulo, nunca no fuso do servidor (UTC na Vercel).

export const FUSO = "America/Sao_Paulo";

export type Formato = "imagem" | "reel";
export type Horario = { dia_semana: number; hora: string; ativo: boolean; formato?: Formato };

const partes = (d: Date) => {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { data: `${p.year}-${p.month}-${p.day}`, diaSemana: dias.indexOf(p.weekday), hora: `${p.hour}:${p.minute}` };
};

/** Data (AAAA-MM-DD), dia da semana (0=domingo) e hora (HH:MM) do instante em São Paulo. */
export function diaSP(d: Date) {
  return partes(d);
}

/** Instante UTC que corresponde a <data> <hora> no relógio de São Paulo. */
export function paraUtcSP(data: string, hora: string): Date {
  const [y, m, d] = data.split("-").map(Number);
  const [h, min] = hora.split(":").map(Number);
  // palpite em UTC e correção pelo deslocamento real do fuso nesse instante
  let t = Date.UTC(y, m - 1, d, h, min);
  for (let i = 0; i < 2; i++) {
    const p = partes(new Date(t));
    const [py, pm, pd] = p.data.split("-").map(Number);
    const [ph, pmin] = p.hora.split(":").map(Number);
    const visto = Date.UTC(py, pm - 1, pd, ph, pmin);
    t += Date.UTC(y, m - 1, d, h, min) - visto;
  }
  return new Date(t);
}

const somarDias = (data: string, n: number) => {
  const [y, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/**
 * Próximo horário de postagem a partir de agora:
 * hoje (se ativo e o horário ainda não passou) ou o próximo dia ativo,
 * pulando dias que já têm outro criativo agendado (1 post por dia).
 * `ocupados`: datas AAAA-MM-DD (São Paulo) já reservadas.
 * `formato`: se informado, só dias desse formato (reel só em dia de reel). Sem formato no horário = imagem.
 */
export function calcularAgendamento(agora: Date, horarios: Horario[], ocupados: Set<string>, formato?: Formato): Date | null {
  return proximoSlot(agora, horarios, ocupados, formato)?.quando ?? null;
}

/** Formato do próximo dia ativo e livre (para saber se o "criativo do dia" é imagem ou reel). */
export function proximoFormato(agora: Date, horarios: Horario[], ocupados: Set<string>): Formato {
  return proximoSlot(agora, horarios, ocupados)?.formato ?? "imagem";
}

function proximoSlot(agora: Date, horarios: Horario[], ocupados: Set<string>, formato?: Formato) {
  const hoje = diaSP(agora);
  for (let i = 0; i < 21; i++) {
    const data = somarDias(hoje.data, i);
    const h = horarios.find((x) => x.dia_semana === (hoje.diaSemana + i) % 7);
    if (!h || !h.ativo || ocupados.has(data)) continue;
    const f = h.formato ?? "imagem";
    if (formato && f !== formato) continue;
    const quando = paraUtcSP(data, h.hora.slice(0, 5));
    if (quando.getTime() <= agora.getTime()) continue;
    return { quando, formato: f };
  }
  return null;
}

const NOMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "quarta, 18/11 às 12:00" */
export function formatarAgendado(d: Date): string {
  const p = diaSP(d);
  const [, m, dia] = p.data.split("-");
  return `${NOMES[p.diaSemana]}, ${dia}/${m} às ${p.hora}`;
}
