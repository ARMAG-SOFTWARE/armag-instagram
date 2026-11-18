// Tamanho do título (Cinzel 700) para caber em até 3 linhas na largura útil da arte.
const LARGURA = 864; // 1080 − 2×36 (moldura) − 2×72 (margem)
const LINHAS = 3;
const TAMANHOS = [76, 70, 64, 58, 52, 48, 44];

// largura média aproximada de cada caractere em Cinzel, em "em"
const largura = (ch: string) => (/[MWmw]/.test(ch) ? 0.92 : /[IJLTFijlt1]/.test(ch) ? 0.45 : ch === " " ? 0.3 : /[A-ZÀ-Ý]/.test(ch) ? 0.74 : 0.66);

function linhas(titulo: string, px: number) {
  let n = 1;
  let atual = 0;
  for (const palavra of titulo.split(/\s+/).filter(Boolean)) {
    const w = [...palavra].reduce((s, c) => s + largura(c), 0) * px;
    const espaco = atual === 0 ? 0 : 0.3 * px;
    if (atual + espaco + w > LARGURA && atual > 0) {
      n++;
      atual = w;
    } else atual += espaco + w;
  }
  return n;
}

export function tamanhoTitulo(titulo: string, tituloPx?: number | null): number {
  if (tituloPx && tituloPx >= 30 && tituloPx <= 120) return tituloPx;
  return TAMANHOS.find((px) => linhas(titulo, px) <= LINHAS) ?? TAMANHOS[TAMANHOS.length - 1];
}
