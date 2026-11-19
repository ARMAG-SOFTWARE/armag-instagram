// Protótipo do Reel "massinha" (barbearia, antes × depois). Uso: node scripts/reel/massinha/prototipo.mjs <saida>
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REEL = path.resolve(AQUI, "..");
const RAIZ = path.resolve(AQUI, "..", "..", "..");
const FPS = 30;
const saida = process.argv[2];
const roteiro = "Cortando cabelo e o celular não para? Cliente esperando resposta é cliente perdido. E se fosse assim? Pelo site, o cliente escolhe o serviço, o barbeiro e o horário livre. Pronto, agendado, sem te interromper. Chama no direct e conheça a ARMAG.";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "massinha-"));
fs.writeFileSync(path.join(tmp, "roteiro.txt"), roteiro);
execFileSync("python3", [path.join(REEL, "narrar.py"), path.join(tmp, "roteiro.txt"), tmp], { stdio: "inherit" });
const T = JSON.parse(fs.readFileSync(path.join(tmp, "tempos.json"), "utf8"));
const ini = 0.5;
const cenas = { s1a: 0.0, s1b: ini + T[1].inicio, virada: ini + T[2].inicio - 0.1, demo: ini + T[3].inicio - 0.1, confirma: ini + T[4].inicio - 0.05, depois: ini + T[4].inicio + 1.1, final: ini + T[5].inicio - 0.1 };
const duracao = Math.max(16, ini + T[T.length - 1].fim + 1.8);
fs.writeFileSync(path.join(tmp, "plano.json"), JSON.stringify({ duracao, inicio_fala: ini, final: cenas.final, transicoes: [cenas.virada, cenas.demo, cenas.depois, cenas.final], itens: [] }));
execFileSync("python3", [path.join(REEL, "audio.py"), tmp], { stdio: "inherit" });

const srv = await new Promise((res) => {
  const s = http.createServer((req, rsp) => {
    const f = path.join(RAIZ, decodeURIComponent(req.url.split("?")[0]));
    if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
    rsp.writeHead(200, { "Content-Type": { ".html": "text/html", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2" }[path.extname(f)] ?? "application/octet-stream" });
    fs.createReadStream(f).pipe(rsp);
  }).listen(0, "127.0.0.1", () => res(s));
});
const nav = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const pag = await nav.newPage({ viewport: { width: 1080, height: 1920 } });
pag.on("pageerror", (e) => console.error("página:", e.message));
await pag.addInitScript((d) => { window.DADOS = d; }, { cenas, cta: "Seu cliente agenda sozinho · chama no direct" });
await pag.goto(`http://127.0.0.1:${srv.address().port}/scripts/reel/massinha/cena-barbearia.html`);
await pag.evaluate(() => window.ready);
if (process.env.PREVIA) {
  fs.mkdirSync(saida, { recursive: true });
  for (const t of process.env.PREVIA.split(",").map(Number)) {
    await pag.evaluate((x) => window.renderFrame(x), t);
    await pag.screenshot({ path: path.join(saida, `p${t.toFixed(1)}.png`) });
  }
  await nav.close(); srv.close();
  console.log("prévias", JSON.stringify(cenas));
  process.exit(0);
}
const cdp = await pag.context().newCDPSession(pag);
const q = path.join(tmp, "q"); fs.mkdirSync(q);
const total = Math.round(duracao * FPS);
for (let i = 0; i < total; i++) {
  await pag.evaluate((t) => window.renderFrame(t), i / FPS);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 90 });
  fs.writeFileSync(path.join(q, `${String(i).padStart(5, "0")}.jpg`), Buffer.from(data, "base64"));
}
await nav.close(); srv.close();
fs.mkdirSync(saida, { recursive: true });
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "30", "-i", path.join(q, "%05d.jpg"), "-i", path.join(tmp, "mix.wav"),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", path.join(saida, "massinha-barbearia.mp4")]);
console.log("ok", duracao.toFixed(1), "s", JSON.stringify(cenas));
