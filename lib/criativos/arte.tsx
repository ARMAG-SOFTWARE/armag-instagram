// Arte 1080×1080 do criativo — reproduz criativos/template.html com next/og (Satori).
// Satori não lê .woff2: usamos as versões .woff das mesmas fontes (Cinzel e Inter, licença OFL).
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { tamanhoTitulo } from "./titulo";

export type DadosArte = {
  tipo: string;
  titulo: string;
  titulo_px?: number | null;
  subtitulo: string;
  itens: string[];
  cta: string;
};

const MARCA = path.join(process.cwd(), "criativos", "marca");

const OURO = "#d4a94f";
const OURO_CLARO = "#f3d58c";
const OURO_ESCURO = "#8a6424";
const TEXTO = "#efe6d2";
const TEXTO_2 = "#b9ad93";

let cache: Promise<{ fontes: { name: string; data: ArrayBuffer; weight: 400 | 500 | 700 | 800; style: "normal" }[]; brasao: string }> | null = null;

export function recursos() {
  cache ??= (async () => {
    const fonte = async (arquivo: string) => {
      const b = await readFile(path.join(MARCA, "fonts", arquivo));
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    };
    const [c700, c800, i400, i500, i700, brasao] = await Promise.all([
      fonte("cinzel-latin-700-normal.woff"),
      fonte("cinzel-latin-800-normal.woff"),
      fonte("inter-latin-400-normal.woff"),
      fonte("inter-latin-500-normal.woff"),
      fonte("inter-latin-700-normal.woff"),
      readFile(path.join(MARCA, "brasao-transparente.png")),
    ]);
    return {
      fontes: [
        { name: "Cinzel", data: c700, weight: 700, style: "normal" },
        { name: "Cinzel", data: c800, weight: 800, style: "normal" },
        { name: "Inter", data: i400, weight: 400, style: "normal" },
        { name: "Inter", data: i500, weight: 500, style: "normal" },
        { name: "Inter", data: i700, weight: 700, style: "normal" },
      ],
      brasao: `data:image/png;base64,${brasao.toString("base64")}`,
    };
  })();
  return cache;
}

export const textoOuro = (gradiente: string) => ({
  backgroundImage: gradiente,
  backgroundClip: "text" as const,
  color: "transparent",
});

/** Gera o PNG 1080×1080 do criativo. */
export async function renderizarArte(d: DadosArte): Promise<Buffer> {
  const { fontes, brasao } = await recursos();
  const px = tamanhoTitulo(d.titulo, d.titulo_px);

  const img = new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1080,
          display: "flex",
          position: "relative",
          backgroundColor: "#070707",
          backgroundImage:
            "radial-gradient(circle at 85% 8%, rgba(212,169,79,0.16) 0%, rgba(212,169,79,0) 45%), radial-gradient(circle at 0% 100%, rgba(212,169,79,0.10) 0%, rgba(212,169,79,0) 42%)",
          color: TEXTO,
          fontFamily: "Inter",
        }}
      >
        {/* marca d'água */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={brasao} width={560} height={686} style={{ position: "absolute", right: -90, bottom: -40, opacity: 0.1 }} alt="" />
        {/* moldura */}
        <div
          style={{
            position: "absolute",
            left: 36,
            top: 36,
            width: 1008,
            height: 1008,
            border: "1.5px solid rgba(212,169,79,0.35)",
            borderRadius: 28,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 36,
            top: 36,
            width: 1008,
            height: 1008,
            padding: "64px 72px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* topo */}
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brasao} width={58} height={71} alt="" />
            <div
              style={{
                marginLeft: 18,
                fontFamily: "Cinzel",
                fontWeight: 800,
                fontSize: 34,
                letterSpacing: 6,
                ...textoOuro(`linear-gradient(180deg, ${OURO_CLARO}, ${OURO} 55%, ${OURO_ESCURO})`),
              }}
            >
              ARMAG
            </div>
            <div
              style={{
                marginLeft: "auto",
                fontWeight: 700,
                fontSize: 20,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: "#070707",
                backgroundImage: `linear-gradient(180deg, ${OURO_CLARO}, ${OURO})`,
                padding: "10px 20px",
                borderRadius: 999,
              }}
            >
              {d.tipo}
            </div>
          </div>

          {/* meio */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", marginBottom: "auto", paddingTop: 30 }}>
            <div
              style={{
                fontFamily: "Cinzel",
                fontWeight: 700,
                fontSize: px,
                lineHeight: 1.08,
                letterSpacing: 0.5,
                ...textoOuro(`linear-gradient(180deg, #fff2c9, ${OURO} 60%, #a77a2c)`),
              }}
            >
              {d.titulo}
            </div>
            <div style={{ width: 120, height: 3, margin: "34px 0 30px", backgroundImage: `linear-gradient(90deg, ${OURO}, rgba(212,169,79,0))` }} />
            <div style={{ fontSize: 32, lineHeight: 1.4, fontWeight: 500, maxWidth: 820 }}>{d.subtitulo}</div>
            {d.itens.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", marginTop: 34, gap: 18 }}>
                {d.itens.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", fontSize: 28, fontWeight: 400 }}>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        marginRight: 16,
                        transform: "rotate(45deg)",
                        backgroundImage: `linear-gradient(135deg, ${OURO_CLARO}, ${OURO})`,
                      }}
                    />
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* rodapé */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "1px solid rgba(212,169,79,0.25)",
              paddingTop: 28,
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 700, color: OURO_CLARO }}>{d.cta}</div>
            <div style={{ fontSize: 24, color: TEXTO_2, letterSpacing: 1 }}>@armag.soft</div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080, fonts: fontes },
  );
  return Buffer.from(await img.arrayBuffer());
}
