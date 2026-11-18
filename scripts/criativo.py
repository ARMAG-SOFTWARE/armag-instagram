#!/usr/bin/env python3
"""
Gera um criativo 1080x1080 da ARMAG a partir de um JSON e grava na pasta do post.

Uso:
  python3 scripts/criativo.py criativos/fila/2026-11-18-sistema-de-gestao/post.json

O post.json fica dentro da pasta do post e tem:
  {
    "selo": "Serviço" | "Dica",
    "titulo": "Texto grande (curto, até ~40 caracteres)",
    "titulo_px": 76,                # opcional; diminua para títulos longos
    "subtitulo": "Uma ou duas frases de apoio",
    "itens": ["até 4 tópicos curtos"],   # opcional
    "cta": "Fale com a ARMAG · link na bio",
    "legenda": "Legenda do Instagram, com quebras de linha e #hashtags"
  }

Saídas na mesma pasta:
  imagem.jpg   (1080x1080, JPEG)
  legenda.txt  (copiada de "legenda")

Requer: pip install playwright pillow ; e um Chrome/Chromium
(usa /usr/bin/google-chrome se existir; senão o Chromium do Playwright).
"""
import json
import os
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
TEMPLATE = RAIZ / "criativos" / "template.html"


def gerar(post_json: Path) -> Path:
    dados = json.loads(post_json.read_text(encoding="utf-8"))
    pasta = post_json.parent
    png = pasta / "_render.png"

    exe = "/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None
    with sync_playwright() as p:
        nav = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
        pag = nav.new_page(viewport={"width": 1080, "height": 1080}, device_scale_factor=1)
        pag.add_init_script(f"window.DADOS = {json.dumps(dados, ensure_ascii=False)};")
        pag.goto(TEMPLATE.as_uri())
        pag.evaluate("document.fonts.ready")
        pag.wait_for_timeout(300)

        # garante que o título não estoura: reduz a fonte até caber em 3 linhas
        pag.evaluate(
            """() => {
              const t = document.getElementById('titulo');
              let px = parseFloat(getComputedStyle(t).fontSize);
              const max = px * 1.08 * 3 + 4;
              while (t.scrollHeight > max && px > 40) { px -= 2; t.style.fontSize = px + 'px'; }
            }"""
        )
        pag.screenshot(path=str(png), clip={"x": 0, "y": 0, "width": 1080, "height": 1080})
        nav.close()

    jpg = pasta / "imagem.jpg"
    Image.open(png).convert("RGB").save(jpg, "JPEG", quality=92)
    png.unlink(missing_ok=True)

    if dados.get("legenda"):
        (pasta / "legenda.txt").write_text(dados["legenda"].strip() + "\n", encoding="utf-8")
    return jpg


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for arg in sys.argv[1:]:
        print(gerar(Path(arg).resolve()))
