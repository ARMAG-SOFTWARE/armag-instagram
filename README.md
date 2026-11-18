# ARMAG · Publicar no Instagram

Site pequeno (Next.js) com uma página para publicar imagem + legenda no @armag.soft
e a rota `POST /api/instagram/publicar` que faz o trabalho.

Não precisa instalar nada no computador: o GitHub guarda o código e a Vercel
instala e roda tudo na nuvem.

## 1. Supabase
Storage → **New bucket** → nome `instagram` → ligue **Public bucket** → Save.
Em Project Settings → API, anote a **Project URL** e a **service_role key**.

## 2. GitHub
1. https://github.com/new → nome `armag-instagram` → **Private** → Create.
2. Na página do repositório vazio: **uploading an existing file**.
3. Arraste **o conteúdo** da pasta descompactada (as pastas `app`, `lib` e os arquivos),
   não a pasta em si → **Commit changes**.

## 3. Vercel
1. https://vercel.com/new → importe o repositório `armag-instagram`.
2. Antes do Deploy, abra **Environment Variables** e adicione:

| Nome | Valor |
|---|---|
| `META_PAGE_TOKEN` | token da Página (o que mostrou "Expira: Nunca") |
| `IG_USER_ID` | `17841459392530261` |
| `INSTAGRAM_PUBLISH_SECRET` | uma senha longa inventada por você |
| `SUPABASE_URL` | Project URL do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key do Supabase |
| `SUPABASE_IG_BUCKET` | `instagram` |

3. **Deploy**.

## 4. Usar
Abra o endereço que a Vercel der (ex.: `armag-instagram.vercel.app`), digite a
chave (`INSTAGRAM_PUBLISH_SECRET`), escolha a imagem, escreva a legenda e clique
em **Publicar no Instagram**.

## Pela API (para integrar com outro sistema)
```bash
curl -X POST https://SEU-SITE.vercel.app/api/instagram/publicar \
  -H "x-api-key: SUA_CHAVE" \
  -F "imagem=@armag-post.jpg" \
  -F "legenda=Texto do post #armag"
```

## Limites do Instagram
- Imagem até 8 MB; a rota converte para JPEG e ajusta a proporção (4:5 a 1,91:1)
- Legenda até 2.200 caracteres e 30 hashtags
- 100 posts via API a cada 24 h
- Se o token parar de funcionar (troca de senha do Facebook, remoção do app),
  gere outro no Explorador da Graph API e atualize `META_PAGE_TOKEN` na Vercel

---

# Criativos do dia (geração + publicação automática)

```
criativos/
  template.html          layout 1080x1080 da marca (preto e dourado)
  marca/                 brasão, logo e fontes (Cinzel + Inter)
  rascunhos/<pasta>/     post.json + imagem.jpg + legenda.txt  → NÃO publica
  fila/<pasta>/          imagem.jpg + legenda.txt              → o Action publica
  publicados/<pasta>/    movido para cá após publicar, com resultado.json
scripts/criativo.py      gera imagem.jpg e legenda.txt a partir do post.json
.github/workflows/publicar-instagram.yml
```

Fluxo:
1. Gerar o rascunho: `python3 scripts/criativo.py criativos/rascunhos/<pasta>/post.json`
2. Aprovar: mover a pasta de `rascunhos/` para `fila/` e fazer push na `main`.
3. O GitHub Action chama `POST <ARMAG_SITE_URL>/api/instagram/publicar` e, se der certo,
   move a pasta para `publicados/` (commit com `[skip ci]`).

Secrets do repositório (Settings → Secrets and variables → Actions):
- `ARMAG_SITE_URL` — endereço do site na Vercel, ex.: `https://armag-instagram.vercel.app`
- `INSTAGRAM_PUBLISH_SECRET` — o mesmo valor da variável de mesmo nome na Vercel

O `vercel.json` faz a Vercel ignorar commits que só mexem em criativos/scripts/Action.

---

# Tela `/criativos` (gerar, aprovar e agendar pelo navegador)

Caminho adicional ao fluxo do GitHub Action (que continua funcionando igual).
Abra `https://SEU-DOMINIO.vercel.app/criativos`, entre com a chave (`INSTAGRAM_PUBLISH_SECRET`) e:

1. **Gerar criativo do dia**: o Claude escreve o texto seguindo `criativos/PADRAO.md`
   (alterna Serviço/Dica e não repete os últimos 10 temas). A arte 1080×1080 é desenhada no servidor.
2. **Editar textos**: muda título, subtítulo, tópicos, CTA ou legenda e regenera só a imagem.
   **Gerar outro** descarta o rascunho atual e cria um novo.
3. **Pode postar**: agenda para o horário do dia da semana (fuso de São Paulo).
   Se o horário de hoje já passou, ou o dia está desligado, ou já tem outro post agendado
   nesse dia, vai para o próximo dia ativo livre. **Só publica nesse horário.**
4. **Horários de postagem**: liga/desliga cada dia e define a hora.

O post é publicado pela rota `GET /api/cron/publicar`, que o Supabase chama a cada 5 minutos.
Se der erro, ela tenta de novo em 10 minutos (até 3 vezes); depois o item aparece em vermelho
em **Publicados** com o botão **Tentar de novo**. A rota nunca publica o mesmo criativo duas vezes.

## Configuração (uma vez)

### 1. Banco (Supabase → SQL Editor)
1. Rode `supabase/migrations/0001_criativos.sql` (cria `criativos` e `horarios_postagem`).
2. Abra `supabase/migrations/0002_criativos_cron.sql`, **troque** `SEU-DOMINIO` pelo domínio de
   produção do app na Vercel (o de **Settings → Domains**, não a URL de um deploy específico,
   que é protegida pela Vercel Authentication) e `SEU_CRON_SECRET` pelo valor de `CRON_SECRET`, e rode.
   - Ver se está rodando: `select * from cron.job_run_details order by start_time desc limit 5;`
   - Trocar domínio ou segredo: `select cron.unschedule('armag-publicar-agendados');` e rode o arquivo de novo.

### 2. Vercel → Settings → Environment Variables
| Nome | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | chave da API da Anthropic (console.anthropic.com → API Keys) |
| `CRON_SECRET` | uma senha longa aleatória (a mesma do passo 1.2) |

Nenhuma variável usa o prefixo `NEXT_PUBLIC_`: chaves e tokens ficam só no servidor.
Depois de salvar, faça **Redeploy**.

### Rotas
Todas exigem o header `x-api-key: <INSTAGRAM_PUBLISH_SECRET>`, menos o cron (`Authorization: Bearer <CRON_SECRET>`).

| Rota | O que faz |
|---|---|
| `POST /api/criativos/gerar` | gera texto + imagem como rascunho (`{ "descartar_id": "..." }` descarta o anterior) |
| `PATCH /api/criativos/[id]` | edita os textos de um rascunho e regenera a imagem |
| `POST /api/criativos/[id]/aprovar` | "Pode postar": agenda (também usado no "Tentar de novo") |
| `POST /api/criativos/[id]/cancelar` | volta um agendado para rascunho (`{ "descartar": true }` → cancelado) |
| `POST /api/criativos/[id]/publicar-agora` | publica na hora |
| `GET /api/criativos?status=...` | lista |
| `GET /api/criativos/render/[id]` | PNG da arte |
| `GET/PUT /api/horarios` | horários por dia da semana |
| `GET /api/cron/publicar` | publica os agendados vencidos |

### Detalhes
- Texto: modelo `claude-sonnet-5-5` com saída em JSON validada (título ≤ 40, subtítulo ≤ 110,
  tópicos ≤ 35, legenda ≤ 2.200, 5 a 8 hashtags começando por `#armag`); até 2 novas tentativas.
  Se o modelo recusar por política, a API usa o modelo reserva automaticamente (`fallbacks: "default"`).
- Arte: `next/og` reproduzindo `criativos/template.html`. O Satori não lê `.woff2`, por isso
  `criativos/marca/fonts/` tem também as versões `.woff` (Cinzel e Inter, licença OFL) e o
  `brasao-transparente.png` (o brasão com fundo transparente, no lugar do `mix-blend-mode`).
- Imagens: JPEG 90 em `instagram/criativos/AAAA-MM-DD/<id>.jpg`.
- Testes: `npm test` (agendamento no fuso de SP, validação do texto, tamanho do título).
- O `vercel.json` não faz deploy de commits que só mexem em `criativos/` ou `*.md`.
  Se mudar o `PADRAO.md`, faça um **Redeploy** manual para a tela usar o texto novo.

---

# Reels (vídeo animado com a voz do Jeff)

Nos dias marcados como **Reel** em *Horários de postagem* (padrão: quarta e sexta), o criativo do dia vira um
**Reel de 12 a 20 s**: os mesmos textos animados no visual da ARMAG, música e narração com a voz do Jeff
(Piper, licença CC0). Tudo gratuito: o vídeo é montado no **GitHub Actions** deste repositório.

Fluxo na tela: **Gerar** → "Montando o vídeo…" (2 a 4 min, a tela atualiza sozinha) → prévia do vídeo →
**Editar textos / roteiro** (monta de novo) ou **Gerar outro** → **Pode postar** (só agenda em dia de Reel).

A publicação é feita em duas etapas pelo cron (a cada 5 min): envia o vídeo ao Instagram e, quando o
Instagram termina de processar, publica. Nenhuma chamada passa de 60 s e o mesmo Reel nunca sai duas vezes.

## Configuração (uma vez)

1. **Supabase → SQL Editor:** rode `supabase/migrations/0003_reels.sql`.
2. **GitHub → Settings → Secrets and variables → Actions → New repository secret:**
   - `SUPABASE_URL` — `https://wufegihensmnfqxsinae.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` — a mesma service_role usada na Vercel
3. **Token do GitHub para a Vercel disparar a montagem:**
   GitHub → foto do perfil → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
   - Resource owner: **ARMAG-SOFTWARE** · Repository access: **Only select repositories → armag-instagram**
   - Permissions → Repository → **Actions: Read and write** (o resto fica sem acesso)
   - Expiração: a maior disponível (anote para renovar)
4. **Vercel → Environment Variables:** `GITHUB_TOKEN_REELS` = o token do passo 3 → **Redeploy**.

O workflow `.github/workflows/reel.yml` precisa estar na `main` para poder ser disparado.

## Arquivos
- `scripts/reel/montar.mjs` — orquestra: narração → música → quadros → MP4 → Supabase
  (teste local: `node scripts/reel/montar.mjs --local scripts/reel/exemplo.json --saida /tmp/reel`).
- `scripts/reel/narrar.py` — voz do Jeff, frase por frase (mede os tempos para sincronizar as cenas).
- `scripts/reel/audio.py` — música e efeitos sintetizados + mixagem (voz por cima, −14 LUFS).
- `scripts/reel/composicao.html` — a animação 1080×1920, desenhada quadro a quadro.
- `lib/criativos/reel.ts` — publicação em duas etapas; `lib/criativos/github.ts` — dispara o workflow.
