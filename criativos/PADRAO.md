# Padrão dos criativos — ARMAG (@armag.soft)

Referência para **todo** criativo do dia. Modelo aprovado:
`criativos/rascunhos/2026-11-17-sistema-de-gestao/`.

---

## 1. Frequência e tipo

- **1 post por dia**, no feed, imagem única **1080×1080**.
- **Alterna o tipo** a cada dia:
  - **Serviço** — divulga algo que a ARMAG faz.
  - **Dica** — conteúdo útil para pequenos negócios.
- Para saber o tipo de hoje, veja o `selo` do último post em `criativos/publicados/`.
- Não repetir o tema dos últimos 10 posts.

### Temas de Serviço
Sistemas de gestão sob medida · landing pages e sites · automações (ex.: cobrança pelo
WhatsApp) · controle financeiro · estoque e vendas · relatórios e painéis · acesso pelo celular.

### Temas de Dica
Gestão do dia a dia · fluxo de caixa · cobrança e inadimplência · organização de estoque ·
vendas e atendimento · produtividade · como a tecnologia ajuda o pequeno negócio.

---

## 2. Identidade visual

| Elemento | Padrão |
|---|---|
| Fundo | Preto `#070707` com brilho dourado suave no canto superior direito e inferior esquerdo |
| Moldura | Borda fina dourada (35% de opacidade), cantos arredondados |
| Dourado | Gradiente `#f3d58c` → `#d4a94f` → `#8a6424` |
| Texto | Creme `#efe6d2`; texto secundário `#b9ad93` |
| Título | **Cinzel** 700, dourado em gradiente, até 3 linhas |
| Corpo | **Inter** 500 (subtítulo) e 400 (tópicos) |
| Marca d'água | Brasão do leão no canto inferior direito, 10% de opacidade |

### Estrutura da arte (de cima para baixo)

```
┌──────────────────────────────────────────────┐
│ [brasão] ARMAG                   ( SELO )    │  ← topo: marca + selo "SERVIÇO" ou "DICA"
│                                              │
│ TÍTULO GRANDE EM                             │  ← Cinzel, dourado, curto e forte
│ DOURADO                                      │
│ ────                                         │  ← linha dourada
│ Subtítulo de 1 a 2 frases explicando.        │
│                                              │
│ ◆ Tópico 1                                   │  ← até 4 tópicos curtos (opcional)
│ ◆ Tópico 2                                   │
│ ◆ Tópico 3                                   │
│ ◆ Tópico 4                                   │
│ ──────────────────────────────────────────── │
│ CTA em dourado                  @armag.soft  │  ← rodapé
└──────────────────────────────────────────────┘
```

Tudo isso já está em `criativos/template.html` e é preenchido pelo `post.json`.

---

## 3. Textos da arte

| Campo | Regra | Exemplo |
|---|---|---|
| `selo` | `"Serviço"` ou `"Dica"` | `Serviço` |
| `titulo` | Até ~40 caracteres, frase de impacto | `Seu negócio no controle` |
| `subtitulo` | 1–2 frases, até ~110 caracteres | `Sistema de gestão sob medida: vendas, estoque, financeiro e cobrança em um só lugar.` |
| `itens` | 0 a 4 tópicos, até ~35 caracteres cada | `Cobrança automática pelo WhatsApp` |
| `cta` | Curto, termina com o canal | Serviço: `Peça uma demonstração · link na bio` · Dica: `Salve este post · siga @armag.soft` |

- Português do Brasil, tom **confiante e direto**, sem exageros.
- **Não inventar** números, clientes, prêmios, prazos ou preços.
- Sem fotos de pessoas reais e sem marcas de terceiros.

---

## 4. Legenda (Instagram)

Estrutura em 4 blocos, separados por linha em branco:

1. **Gancho** — 1 frase com a dor ou curiosidade + 1 emoji.
2. **Desenvolvimento** — 1 parágrafo curto explicando a solução (Serviço) ou a dica (Dica).
3. **CTA** — chamada para ação + 👑
   - Serviço: "Chama no direct ou pelo link na bio."
   - Dica: "Salve para lembrar e siga @armag.soft para mais dicas."
4. **Hashtags** — 5 a 8, sempre começando por `#armag`.

Modelo aprovado:

```
Planilha espalhada, caderno de anotações e cobrança no improviso custam caro. 📉

Na ARMAG a gente desenvolve sistemas de gestão sob medida para pequenos negócios: vendas, estoque, financeiro e cobrança automática pelo WhatsApp, tudo num lugar só e acessível pelo celular.

Quer ver como ficaria no seu negócio? Chama no direct ou pelo link na bio. 👑

#armag #sistemadegestao #pequenosnegocios #automacao #empreendedorismo #gestaoempresarial #software
```

Limites: até 2.200 caracteres e no máximo 30 hashtags (usamos 5 a 8).

---

## 5. Arquivos de cada post

Pasta: `criativos/rascunhos/AAAA-MM-DD-slug/` (slug curto, sem acento, com hífens).

```json
{
  "selo": "Serviço",
  "titulo": "Seu negócio no controle",
  "subtitulo": "Sistema de gestão sob medida: vendas, estoque, financeiro e cobrança em um só lugar.",
  "itens": [
    "Vendas e estoque integrados",
    "Cobrança automática pelo WhatsApp",
    "Relatórios em tempo real",
    "Acesso pelo celular"
  ],
  "cta": "Peça uma demonstração · link na bio",
  "legenda": "…legenda completa, com \\n para quebras de linha…"
}
```

Gerar a arte:

```bash
python3 scripts/criativo.py criativos/rascunhos/AAAA-MM-DD-slug/post.json
```

Saídas: `imagem.jpg` e `legenda.txt` na mesma pasta.

---

## 6. Fluxo de aprovação e publicação

1. Gerar o rascunho em `criativos/rascunhos/` e fazer push (rascunho **não** publica).
2. Mostrar a imagem e a legenda para aprovação.
3. Ajustes pedidos → editar o `post.json`, gerar de novo e mostrar outra vez.
4. **"Pode postar"** → mover a pasta para `criativos/fila/` e fazer push na `main`.
5. O GitHub Action publica e move a pasta para `criativos/publicados/` com o `resultado.json`
   (que tem o `permalink` do post).

---

## 7. Checklist antes de mostrar

- [ ] Tipo do dia correto (alternou em relação ao último publicado)
- [ ] Tema diferente dos últimos 10 posts
- [ ] Título cabe em até 3 linhas e nada fica cortado
- [ ] Acentos e ç corretos na arte e na legenda
- [ ] Nenhum número, cliente ou preço inventado
- [ ] CTA coerente com o tipo (Serviço → contato; Dica → salvar/seguir)
- [ ] Legenda com os 4 blocos e 5 a 8 hashtags começando por `#armag`
- [ ] `imagem.jpg` em 1080×1080
