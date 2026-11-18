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
