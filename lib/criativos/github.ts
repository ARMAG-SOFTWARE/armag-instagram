// Dispara o workflow que monta o vídeo do Reel (.github/workflows/reel.yml) no GitHub Actions.
// Token: GITHUB_TOKEN_REELS — fine-grained, só este repositório, permissão "Actions: Read and write".
const REPO = process.env.GITHUB_REELS_REPO ?? "ARMAG-SOFTWARE/armag-instagram";
const WORKFLOW = "reel.yml";
const REF = process.env.GITHUB_REELS_REF ?? "main";

export async function dispararRender(criativoId: string, f: typeof fetch = fetch): Promise<void> {
  const token = process.env.GITHUB_TOKEN_REELS;
  if (!token) throw new Error("Variável GITHUB_TOKEN_REELS não configurada na Vercel (necessária para montar Reels).");
  const res = await f(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: REF, inputs: { criativo_id: criativoId } }),
  });
  if (res.status !== 204 && !res.ok) {
    const corpo = await res.text().catch(() => "");
    throw new Error(`GitHub não iniciou a montagem do vídeo (${res.status}): ${corpo.slice(0, 200)}`);
  }
}
