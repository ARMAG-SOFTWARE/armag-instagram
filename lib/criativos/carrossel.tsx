// Slides do carrossel (1080×1350, 4:5) no visual da ARMAG: capa · conteúdo · final.
import { ImageResponse } from "next/og";
import { recursos, textoOuro } from "./arte";
import type { Slide } from "./schema";

const OURO = "#d4a94f";
const OURO_CLARO = "#f3d58c";
const OURO_ESCURO = "#8a6424";
const TEXTO = "#efe6d2";
const TEXTO_2 = "#b9ad93";
const L = 1080;
const A = 1350;
const GRAD_TITULO = `linear-gradient(180deg, #fff2c9, ${OURO} 60%, #a77a2c)`;

export type DadosCarrossel = { tipo: string; titulo: string; subtitulo: string; cta: string; slides: Slide[] };

// largura média dos caracteres em Cinzel (em "em") para escolher um tamanho que caiba
const largura = (ch: string) => (/[MWmw]/.test(ch) ? 0.92 : /[IJLTFijlt1]/.test(ch) ? 0.45 : ch === " " ? 0.3 : /[A-ZÀ-Ý]/.test(ch) ? 0.74 : 0.66);
function caber(texto: string, tamanhos: number[], larguraUtil: number, maxLinhas: number) {
  for (const px of tamanhos) {
    let linhas = 1;
    let atual = 0;
    for (const p of texto.split(/\s+/).filter(Boolean)) {
      const w = [...p].reduce((s, c) => s + largura(c), 0) * px;
      const esp = atual ? 0.3 * px : 0;
      if (atual && atual + esp + w > larguraUtil) {
        linhas++;
        atual = w;
      } else atual += esp + w;
    }
    if (linhas <= maxLinhas) return px;
  }
  return tamanhos[tamanhos.length - 1];
}

function Fundo({ brasao, children, n, total }: { brasao: string; children: React.ReactNode; n: number; total: number }) {
  return (
    <div
      style={{
        width: L, height: A, display: "flex", position: "relative", backgroundColor: "#070707", color: TEXTO, fontFamily: "Inter",
        backgroundImage:
          "radial-gradient(circle at 88% 6%, rgba(212,169,79,0.17) 0%, rgba(212,169,79,0) 45%), radial-gradient(circle at 0% 100%, rgba(212,169,79,0.10) 0%, rgba(212,169,79,0) 42%)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={brasao} width={600} height={735} style={{ position: "absolute", right: -110, bottom: -60, opacity: 0.09 }} alt="" />
      <div style={{ position: "absolute", left: 36, top: 36, width: L - 72, height: A - 72, border: "1.5px solid rgba(212,169,79,0.35)", borderRadius: 28, display: "flex" }} />
      <div style={{ position: "absolute", left: 36, top: 36, width: L - 72, height: A - 72, padding: "64px 72px", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
      <div style={{ position: "absolute", right: 108, bottom: 96, fontSize: 24, color: TEXTO_2, letterSpacing: 2 }}>{`${n}/${total}`}</div>
    </div>
  );
}

function Topo({ brasao, tipo }: { brasao: string; tipo: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={brasao} width={58} height={71} alt="" />
      <div style={{ marginLeft: 18, fontFamily: "Cinzel", fontWeight: 800, fontSize: 34, letterSpacing: 6, ...textoOuro(`linear-gradient(180deg, ${OURO_CLARO}, ${OURO} 55%, ${OURO_ESCURO})`) }}>ARMAG</div>
      <div
        style={{
          marginLeft: "auto", fontWeight: 700, fontSize: 20, letterSpacing: 4, textTransform: "uppercase", color: "#070707",
          backgroundImage: `linear-gradient(180deg, ${OURO_CLARO}, ${OURO})`, padding: "10px 20px", borderRadius: 999,
        }}
      >
        {tipo}
      </div>
    </div>
  );
}

const Linha = () => <div style={{ width: 120, height: 3, margin: "36px 0 32px", backgroundImage: `linear-gradient(90deg, ${OURO}, rgba(212,169,79,0))` }} />;

/** Renderiza todos os slides (PNG) na ordem: capa, conteúdos, final. */
export async function renderizarCarrossel(d: DadosCarrossel): Promise<Buffer[]> {
  const { fontes, brasao } = await recursos();
  const total = d.slides.length + 2;
  const telas: React.ReactElement[] = [];

  // capa
  const pxCapa = caber(d.titulo, [96, 88, 80, 72, 64, 58], 864, 4);
  telas.push(
    <Fundo brasao={brasao} n={1} total={total}>
      <Topo brasao={brasao} tipo={d.tipo} />
      <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", marginBottom: "auto" }}>
        <div style={{ fontFamily: "Cinzel", fontWeight: 700, fontSize: pxCapa, lineHeight: 1.08, ...textoOuro(GRAD_TITULO) }}>{d.titulo}</div>
        <Linha />
        <div style={{ fontSize: 38, lineHeight: 1.4, fontWeight: 500, maxWidth: 860 }}>{d.subtitulo}</div>
      </div>
      <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: OURO_CLARO, letterSpacing: 1 }}>Arrasta pro lado →</div>
    </Fundo>,
  );

  // conteúdo
  d.slides.forEach((s, i) => {
    const px = caber(s.titulo, [76, 70, 64, 58, 52], 864, 3);
    telas.push(
      <Fundo brasao={brasao} n={i + 2} total={total}>
        <Topo brasao={brasao} tipo={d.tipo} />
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", marginBottom: "auto" }}>
          <div style={{ fontFamily: "Cinzel", fontWeight: 800, fontSize: 120, lineHeight: 1, ...textoOuro(`linear-gradient(180deg, ${OURO_CLARO}, ${OURO_ESCURO})`), opacity: 0.9 }}>
            {String(i + 1).padStart(2, "0")}
          </div>
          <div style={{ marginTop: 28, fontFamily: "Cinzel", fontWeight: 700, fontSize: px, lineHeight: 1.1, ...textoOuro(GRAD_TITULO) }}>{s.titulo}</div>
          {s.texto ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <Linha />
              <div style={{ fontSize: 38, lineHeight: 1.45, fontWeight: 400, maxWidth: 860 }}>{s.texto}</div>
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", height: 34 }} />
      </Fundo>,
    );
  });

  // final
  telas.push(
    <Fundo brasao={brasao} n={total} total={total}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={brasao} width={260} height={318} alt="" />
        <div style={{ marginTop: 22, fontFamily: "Cinzel", fontWeight: 800, fontSize: 60, letterSpacing: 12, ...textoOuro(`linear-gradient(180deg, ${OURO_CLARO}, ${OURO} 55%, ${OURO_ESCURO})`) }}>ARMAG</div>
        <div style={{ marginTop: 56, fontSize: 44, fontWeight: 700, lineHeight: 1.3, color: OURO_CLARO, maxWidth: 820, display: "flex", justifyContent: "center" }}>{d.cta}</div>
        {!/@armag\.soft/i.test(d.cta) && <div style={{ marginTop: 34, fontSize: 36, letterSpacing: 2 }}>@armag.soft</div>}
        <div
          style={{
            marginTop: 30, fontWeight: 700, fontSize: 26, letterSpacing: 4, textTransform: "uppercase", color: "#070707",
            backgroundImage: `linear-gradient(180deg, ${OURO_CLARO}, ${OURO})`, padding: "16px 32px", borderRadius: 999,
          }}
        >
          link na bio
        </div>
      </div>
    </Fundo>,
  );

  const out: Buffer[] = [];
  for (const tela of telas) {
    const img = new ImageResponse(tela, { width: L, height: A, fonts: fontes });
    out.push(Buffer.from(await img.arrayBuffer()));
  }
  return out;
}
