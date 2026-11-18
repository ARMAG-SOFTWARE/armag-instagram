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
