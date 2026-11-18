// Acesso às tabelas public.criativos e public.horarios_postagem (somente servidor, service role).
import { supabaseAdmin } from "./servidor";
import { formatarAgendado, type Horario } from "./agenda";
import type { Tipo } from "./schema";

export type Status = "rascunho" | "agendado" | "publicando" | "publicado" | "erro" | "cancelado";

export type Criativo = {
  id: string;
  criado_em: string;
  tipo: Tipo;
  titulo: string;
  titulo_px: number | null;
  subtitulo: string;
  itens: string[];
  cta: string;
  legenda: string;
  tema: string;
  image_url: string | null;
  status: Status;
  agendado_para: string | null;
  publicado_em: string | null;
  media_id: string | null;
  permalink: string | null;
  erro: string | null;
  tentativas: number;
};

const db = () => supabaseAdmin();

function ok<T>(r: { data: T | null; error: { message: string } | null }, onde: string): T {
  if (r.error) throw new Error(`Supabase (${onde}): ${r.error.message}`);
  return r.data as T;
}

export async function buscar(id: string): Promise<Criativo | null> {
  const r = await db().from("criativos").select("*").eq("id", id).maybeSingle();
  return ok(r, "buscar") as Criativo | null;
}

export async function listar(status?: Status[], limite = 50): Promise<Criativo[]> {
  let q = db().from("criativos").select("*").order("criado_em", { ascending: false }).limit(limite);
  if (status?.length) q = q.in("status", status);
  return ok(await q, "listar") as Criativo[];
}

export async function inserir(c: Omit<Criativo, "id" | "criado_em" | "image_url" | "status" | "agendado_para" | "publicado_em" | "media_id" | "permalink" | "erro" | "tentativas">) {
  return ok(await db().from("criativos").insert({ ...c, status: "rascunho" }).select("*").single(), "inserir") as Criativo;
}

export async function atualizar(id: string, patch: Partial<Criativo>) {
  return ok(await db().from("criativos").update(patch).eq("id", id).select("*").single(), "atualizar") as Criativo;
}

/** Troca o status só se o atual estiver em `de` — trava contra publicação dupla. Devolve null se outro processo pegou antes. */
export async function travar(id: string, de: Status[], para: Status): Promise<Criativo | null> {
  const r = await db().from("criativos").update({ status: para }).eq("id", id).in("status", de).select("*");
  const linhas = ok(r, "travar") as Criativo[];
  return linhas[0] ?? null;
}

/** Último Serviço/Dica publicado ou agendado, e os temas dos últimos 10 criativos. */
export async function historicoParaGerar() {
  const ultimo = ok(
    await db().from("criativos").select("tipo").in("status", ["publicado", "agendado", "publicando"]).order("criado_em", { ascending: false }).limit(1),
    "ultimo tipo",
  ) as { tipo: Tipo }[];
  const temas = ok(
    await db().from("criativos").select("tema").neq("status", "cancelado").order("criado_em", { ascending: false }).limit(10),
    "temas",
  ) as { tema: string }[];
  return { ultimoTipo: ultimo[0]?.tipo ?? null, temas: temas.map((t) => t.tema) };
}

export async function horarios(): Promise<Horario[]> {
  return ok(await db().from("horarios_postagem").select("dia_semana, hora, ativo").order("dia_semana"), "horarios") as Horario[];
}

export async function salvarHorarios(lista: Horario[]) {
  ok(await db().from("horarios_postagem").upsert(lista, { onConflict: "dia_semana" }), "salvar horarios");
}

/** Agendados (e em publicação) a partir de agora — para não marcar 2 posts no mesmo dia. */
export async function agendadosFuturos(excetoId?: string): Promise<Criativo[]> {
  let q = db().from("criativos").select("*").in("status", ["agendado", "publicando"]).not("agendado_para", "is", null);
  if (excetoId) q = q.neq("id", excetoId);
  return ok(await q, "agendados") as Criativo[];
}

export async function vencidos(agora: Date): Promise<Criativo[]> {
  return ok(
    await db().from("criativos").select("*").eq("status", "agendado").lte("agendado_para", agora.toISOString()).order("agendado_para"),
    "vencidos",
  ) as Criativo[];
}

/** Criativo com o texto pronto do agendamento ("quarta, 18/11 às 12:00"). */
export function apresentar(c: Criativo) {
  return { ...c, agendado_texto: c.agendado_para ? formatarAgendado(new Date(c.agendado_para)) : null };
}
