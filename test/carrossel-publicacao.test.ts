import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publicarCarrossel } from "@/lib/instagram";

type Chamada = { url: string; corpo: Record<string, string> };

function fakeFetch(statusFilho = "FINISHED") {
  const chamadas: Chamada[] = [];
  let n = 0;
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const corpo = init?.body ? Object.fromEntries(new URLSearchParams(String(init.body))) : {};
    chamadas.push({ url, corpo });
    const json = (d: unknown) => ({ ok: true, status: 200, json: async () => d });
    if (url.includes("/media_publish")) return json({ id: "m1" });
    if (url.includes("/media")) return json({ id: `c${++n}` });
    if (url.includes("fields=status_code")) return json({ status_code: url.includes("c4") ? "FINISHED" : statusFilho });
    if (url.includes("fields=permalink")) return json({ permalink: "https://instagram.com/p/x" });
    throw new Error("inesperado " + url);
  });
  return { f, chamadas };
}

describe("publicarCarrossel", () => {
  beforeEach(() => {
    process.env.META_PAGE_TOKEN = "tok";
    process.env.IG_USER_ID = "17841";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("cria um filho por imagem, o contêiner CAROUSEL com os filhos e publica", async () => {
    const { f, chamadas } = fakeFetch();
    vi.stubGlobal("fetch", f);
    const r = await publicarCarrossel(["u1", "u2", "u3"], "Legenda #armag");
    const criacoes = chamadas.filter((c) => c.url.endsWith("/17841/media"));
    expect(criacoes.slice(0, 3).map((c) => c.corpo)).toEqual([
      expect.objectContaining({ image_url: "u1", is_carousel_item: "true" }),
      expect.objectContaining({ image_url: "u2", is_carousel_item: "true" }),
      expect.objectContaining({ image_url: "u3", is_carousel_item: "true" }),
    ]);
    expect(criacoes[3].corpo).toMatchObject({ media_type: "CAROUSEL", children: "c1,c2,c3", caption: "Legenda #armag" });
    expect(chamadas.find((c) => c.url.endsWith("/media_publish"))?.corpo).toMatchObject({ creation_id: "c4" });
    expect(r).toMatchObject({ mediaId: "m1", permalink: "https://instagram.com/p/x" });
  });

  it("recusa menos de 2 ou mais de 10 imagens sem chamar o Instagram", async () => {
    const { f } = fakeFetch();
    vi.stubGlobal("fetch", f);
    await expect(publicarCarrossel(["u1"], "x")).rejects.toThrow(/2 a 10/);
    expect(f).not.toHaveBeenCalled();
  });

  it("filho com ERROR → falha antes de publicar", async () => {
    const { f, chamadas } = fakeFetch("ERROR");
    vi.stubGlobal("fetch", f);
    await expect(publicarCarrossel(["u1", "u2"], "x")).rejects.toThrow(/ERROR/);
    expect(chamadas.some((c) => c.url.endsWith("/media_publish"))).toBe(false);
  });
});
