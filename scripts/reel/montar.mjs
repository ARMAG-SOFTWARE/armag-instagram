// Monta o vídeo do Reel (1080×1920, 30 fps, H.264 + AAC) a partir de um criativo e sobe no Supabase.
// Roda no GitHub Actions (.github/workflows/reel.yml).
//
// Uso:
//   node scripts/reel/montar.mjs <criativo_id>                          → lê e grava no Supabase
//   node scripts/reel/montar.mjs --local exemplo.json --saida pasta/     → teste local, sem Supabase
//
// Requer: python3 com piper-tts, numpy e scipy; ffmpeg; Playwright (Chromium); voz em $PIPER_VOICES.
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..", "..");
const FPS = 30;
const BUCKET = process.env.SUPABASE_IG_BUCKET ?? "instagram";

const args = process.argv.slice(2);
const local = args.includes("--local") ? args[args.indexOf("--local") + 1] : null;
const saidaLocal = args.includes("--saida") ? args[args.indexOf("--saida") + 1] : null;
const id = local ? null : args[0];
if (!local && !id) {
  console.error("uso: node scripts/reel/montar.mjs <criativo_id> | --local post.json --saida pasta");
  process.exit(2);
}
const sb = local ? null : createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/* ---------- tamanho do título (Cinzel 700) para até 4 linhas em 880 px ---------- */
const largura = (ch) => (/[MWmw]/.test(ch) ? 0.92 : /[IJLTFijlt1]/.test(ch) ? 0.45 : ch === " " ? 0.3 : /[A-ZÀ-Ý]/.test(ch) ? 0.74 : 0.66);
function tamanhoTitulo(titulo) {
  for (const px of [108, 100, 92, 84, 76, 68, 60]) {
    let linhas = 1, atual = 0;
    for (const p of titulo.split(/\s+/).filter(Boolean)) {
      const w = [...p].reduce((s, c) => s + largura(c), 0) * px;
      const esp = atual ? 0.3 * px : 0;
      if (atual && atual + esp + w > 880) { linhas++; atual = w; } else atual += esp + w;
    }
    if (linhas <= 4) return px;
  }
  return 60;
}

/* ---------- linha do tempo a partir das frases narradas ---------- */
export function planejar(tempos, nItens) {
  const inicioFala = 0.6;
  const n = tempos.length;
  const fimFala = inicioFala + tempos[n - 1].fim;
  const titulo = 0.45;
  const subtitulo = inicioFala + (n >= 2 ? tempos[1].inicio : tempos[0].fim * 0.4);
  let final = inicioFala + (n >= 3 ? tempos[n - 1].inicio : fimFala - 2.6);
  final = Math.max(final, subtitulo + (nItens ? 1.4 + nItens * 0.9 : 2.2));
  const duracao = Math.min(20, Math.max(12, fimFala + 1.8, final + 3.2));
  const iniItens = n >= 4 ? Math.max(inicioFala + tempos[2].inicio, subtitulo + 1.0) : subtitulo + 1.2;
  const passo = nItens > 1 ? Math.max(0.35, (final - 0.8 - iniItens) / (nItens - 1)) : 0;
  const itens = Array.from({ length: nItens }, (_, i) => +(iniItens + i * passo).toFixed(2));
  return { inicio_fala: inicioFala, duracao: +duracao.toFixed(2), final: +final.toFixed(2), cenas: { titulo, subtitulo: +subtitulo.toFixed(2), itens, final: +final.toFixed(2) } };
}

function servir() {
  const tipos = { ".html": "text/html", ".png": "image/png", ".woff2": "font/woff2", ".js": "text/javascript" };
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const f = path.join(RAIZ, decodeURIComponent(req.url.split("?")[0]));
      if (!f.startsWith(RAIZ + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { "Content-Type": tipos[path.extname(f)] ?? "application/octet-stream" });
      fs.createReadStream(f).pipe(rsp);
    }).listen(0, "127.0.0.1", () => res(srv));
  });
}

const sh = (cmd, a) => execFileSync(cmd, a, { stdio: ["ignore", "inherit", "inherit"] });

async function principal() {
  const c = local
    ? JSON.parse(fs.readFileSync(local, "utf8"))
    : (await sb.from("criativos").select("*").eq("id", id).single()).data;
  if (!c) throw new Error(`criativo ${id} não encontrado`);
  if (!c.roteiro) throw new Error("criativo sem roteiro para narrar");
  const itens = Array.isArray(c.itens) ? c.itens : [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "reel-"));

  // 1) narração
  fs.writeFileSync(path.join(tmp, "roteiro.txt"), c.roteiro);
  sh("python3", [path.join(AQUI, "narrar.py"), path.join(tmp, "roteiro.txt"), tmp]);
  const tempos = JSON.parse(fs.readFileSync(path.join(tmp, "tempos.json"), "utf8"));

  // 2) linha do tempo, música e mixagem
  const pl = planejar(tempos, itens.length);
  fs.writeFileSync(path.join(tmp, "plano.json"), JSON.stringify({ duracao: pl.duracao, inicio_fala: pl.inicio_fala, final: pl.final, transicoes: [pl.final], itens: pl.cenas.itens }));
  sh("python3", [path.join(AQUI, "audio.py"), tmp]);

  // 3) quadros
  const dados = { tipo: c.tipo, titulo: c.titulo, titulo_px: tamanhoTitulo(c.titulo), subtitulo: c.subtitulo, itens, cta: c.cta, duracao: pl.duracao, cenas: pl.cenas };
  const srv = await servir();
  const nav = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const quadros = path.join(tmp, "quadros");
  fs.mkdirSync(quadros);
  const capa = path.join(tmp, "capa.jpg");
  try {
    const pag = await nav.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    pag.on("pageerror", (e) => console.error("erro na página:", e.message));
    await pag.addInitScript((d) => { window.DADOS = d; }, dados);
    await pag.goto(`http://127.0.0.1:${srv.address().port}/scripts/reel/composicao.html`);
    await pag.evaluate(() => window.ready);
    const cdp = await pag.context().newCDPSession(pag);
    const total = Math.round(pl.duracao * FPS);
    for (let i = 0; i < total; i++) {
      await pag.evaluate((t) => window.renderFrame(t), i / FPS);
      const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 92 });
      fs.writeFileSync(path.join(quadros, `${String(i).padStart(5, "0")}.jpg`), Buffer.from(data, "base64"));
    }
    // capa: título e subtítulo já na tela
    await pag.evaluate((t) => window.renderFrame(t), Math.min(pl.cenas.subtitulo + 0.7, pl.final - 0.4));
    await pag.screenshot({ path: capa, type: "jpeg", quality: 90 });
  } finally {
    await nav.close();
    srv.close();
  }

  // 4) vídeo final
  const mp4 = path.join(tmp, "reel.mp4");
  sh("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(quadros, "%05d.jpg"), "-i", path.join(tmp, "mix.wav"),
    "-c:v", "libx264", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-shortest", mp4]);
  console.log(`vídeo: ${pl.duracao}s, ${Math.round(fs.statSync(mp4).size / 1024)} KB`);

  if (local) {
    fs.mkdirSync(saidaLocal, { recursive: true });
    fs.copyFileSync(mp4, path.join(saidaLocal, "reel.mp4"));
    fs.copyFileSync(capa, path.join(saidaLocal, "capa.jpg"));
    console.log("salvo em", saidaLocal);
    return;
  }

  // 5) sobe e grava no criativo
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const subir = async (arquivo, destino, tipo) => {
    const { error } = await sb.storage.from(BUCKET).upload(destino, fs.readFileSync(arquivo), { contentType: tipo, upsert: true });
    if (error) throw new Error(`Supabase Storage: ${error.message}`);
    return `${sb.storage.from(BUCKET).getPublicUrl(destino).data.publicUrl}?v=${Date.now()}`;
  };
  const videoUrl = await subir(mp4, `reels/${dia}/${id}.mp4`, "video/mp4");
  const capaUrl = await subir(capa, `reels/${dia}/${id}-capa.jpg`, "image/jpeg");
  const { error } = await sb.from("criativos").update({ video_url: videoUrl, image_url: capaUrl, status: "rascunho", erro: null }).eq("id", id).eq("status", "renderizando");
  if (error) throw new Error(`Supabase: ${error.message}`);
  console.log("pronto:", videoUrl);
}

principal().catch(async (e) => {
  console.error("ERRO:", e.message);
  if (sb && id) await sb.from("criativos").update({ status: "erro", erro: `Montagem do vídeo: ${e.message}`.slice(0, 500) }).eq("id", id).eq("status", "renderizando");
  process.exit(1);
});
