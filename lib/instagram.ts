// lib/instagram.ts
// Publicação no Instagram via Graph API (conta profissional vinculada à Página).
// Roda SÓ no servidor: usa o token da Página, que nunca deve ir para o front.

const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v27.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

type GraphError = { error?: { message?: string; error_user_msg?: string; code?: number } };

async function graphPost<T>(path: string, params: Record<string, string>): Promise<T> {
  const body = new URLSearchParams({ ...params, access_token: env("META_PAGE_TOKEN") });
  const res = await fetch(`${GRAPH}/${path}`, { method: "POST", body });
  const json = (await res.json()) as T & GraphError;
  if (!res.ok || json.error) {
    const e = json.error;
    throw new Error(`Graph API: ${e?.error_user_msg || e?.message || res.statusText} (code ${e?.code ?? res.status})`);
  }
  return json;
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ ...params, access_token: env("META_PAGE_TOKEN") });
  const res = await fetch(`${GRAPH}/${path}?${qs}`);
  const json = (await res.json()) as T & GraphError;
  if (!res.ok || json.error) {
    throw new Error(`Graph API: ${json.error?.message || res.statusText}`);
  }
  return json;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Espera o container ficar pronto (o Instagram baixa e processa a imagem antes). */
async function aguardarContainer(containerId: string, tentativas = 10) {
  for (let i = 0; i < tentativas; i++) {
    const { status_code } = await graphGet<{ status_code: string }>(containerId, { fields: "status_code" });
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new Error(`Container ${containerId} com status ${status_code}`);
    }
    await sleep(2000);
  }
  throw new Error("Tempo esgotado esperando o Instagram processar a imagem");
}

/**
 * Publica uma imagem no feed.
 * imageUrl: link PÚBLICO e direto para um JPEG (proporção entre 4:5 e 1,91:1).
 */
export async function publicarImagem(imageUrl: string, legenda = "") {
  const igUserId = env("IG_USER_ID");

  // 1) cria o container
  const { id: containerId } = await graphPost<{ id: string }>(`${igUserId}/media`, {
    image_url: imageUrl,
    caption: legenda, // URLSearchParams já codifica acentos, # e quebras de linha
  });

  // 2) espera processar
  await aguardarContainer(containerId);

  // 3) publica
  const { id: mediaId } = await graphPost<{ id: string }>(`${igUserId}/media_publish`, {
    creation_id: containerId,
  });

  // link do post (opcional, só para retorno)
  const { permalink } = await graphGet<{ permalink?: string }>(mediaId, { fields: "permalink" });

  return { containerId, mediaId, permalink };
}
