// Marca o criativo como "erro" se o workflow falhou antes do montar.mjs conseguir registrar (ex.: instalação).
import { createClient } from "@supabase/supabase-js";

const [id, msg] = process.argv.slice(2);
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { error } = await sb.from("criativos").update({ status: "erro", erro: msg }).eq("id", id).eq("status", "renderizando");
if (error) console.error(error.message);
