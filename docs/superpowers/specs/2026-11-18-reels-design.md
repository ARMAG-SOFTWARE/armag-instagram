# Reels automáticos na tela /criativos — design

## Intenção
O dono quer que o @armag.soft publique **Reels 2 vezes por semana, no lugar da imagem nesses dias**.

O Reel é a **versão animada do criativo do dia**:
- duração de 12 a 15 s, formato vertical;
- os mesmos textos que o Claude já gera;
- visual preto e dourado da ARMAG;
- música;
- **narração com a voz do Jeff** (Piper, pt_BR).

O fluxo é o mesmo da imagem: Gerar → prévia → Editar ou Gerar outro → Pode postar → publica no horário.

**Sem serviço pago:** a montagem do vídeo roda no **GitHub Actions** deste repositório.

## Objetivos
- Escolher na tela, **por dia da semana**, se o post é **imagem** ou **reel**. Padrão: quarta e sexta = reel.
- "Gerar criativo do dia" produz o formato do próximo dia livre. Há também um botão para trocar entre imagem e reel na hora de gerar.
- A prévia do vídeo aparece na tela em poucos minutos, com o aviso "Montando o vídeo…".
- Publicar Reels pela Graph API respeitando o tempo de processamento do Instagram, sem estourar o limite de 60 s das funções da Vercel.

## Fora do escopo
- Reels com gravação de telas reais (demonstrações). Esses continuam sob demanda.
- Legendas queimadas palavra por palavra.
- Outras vozes.
- Edição de vídeo na tela.

## O que não pode acontecer
- Serviço pago de vídeo, voz ou hospedagem.
- Publicar duas vezes.
- Publicar um vídeo que ainda está sendo montado.
- Quebrar o fluxo atual de imagens, o Action de `criativos/fila/` ou a rota `/api/instagram/publicar`.
- Texto ou narração com afirmações fora do `PADRAO.md`.

## Abordagens consideradas
| | Como | Troca |
|---|---|---|
| **1. GitHub Actions (escolhida)** | A tela dispara um workflow que monta o MP4 com Chromium, FFmpeg e Piper | Gratuito no volume previsto (2.000 min/mês grátis; cerca de 5 min por vídeo). Reaproveita a técnica dos vídeos do Clube da Navalha. A prévia leva de 2 a 4 min. |
| 2. Serviço pago (Creatomate, Shotstack) | API devolve o MP4 | Recusado pelo dono (custo mensal) |
| 3. Gravar no navegador | MediaRecorder na própria tela | Instável. O Chrome gera WebM, que o Instagram não aceita direto. |

## Como funciona (decidido)

### Banco (migration `0003_reels.sql`)
- `horarios_postagem.formato text not null default 'imagem' check (formato in ('imagem','reel'))`. Quarta (3) e sexta (5) começam como `reel`.
- `criativos`, colunas novas:
  - `formato` (`'imagem'` ou `'reel'`, padrão `'imagem'`);
  - `roteiro` (texto narrado);
  - `video_url`;
  - `container_id` (container de Reel em processamento no Instagram).
- `criativos.status` ganha dois valores:
  - `renderizando` (o vídeo está sendo montado);
  - `processando` (o Instagram está processando o Reel antes de publicar).

### Texto
- `gerarTexto` recebe `formato`.
- No reel, o JSON inclui `roteiro`: 25 a 40 palavras (cerca de 12 a 15 s de fala), começando com o gancho e terminando com o CTA falado ("Chama no direct", "Siga a @armag.soft"). A validação conta as palavras.
- A arte de capa (imagem 1080×1080 atual) não muda.

### Montagem do vídeo: workflow `.github/workflows/reel.yml`
**Disparo:** `workflow_dispatch` com o input `criativo_id`. A rota da Vercel chama a API do GitHub com `GITHUB_TOKEN_REELS`, um token fine-grained só deste repositório com permissão **Actions: write**.

**Passos do job:**
1. Instala as ferramentas, com cache:
   - Node, Playwright Chromium e FFmpeg;
   - Python com `piper-tts`, `numpy` e `scipy`;
   - a voz `pt_BR-jeff-medium` (CC0, do repositório rhasspy/piper-voices).
2. `scripts/reel/montar.mjs <id>`:
   1. Lê o criativo no Supabase. Os secrets do repositório são `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
   2. **Narração:** o Piper lê o `roteiro` (`scripts/reel/narrar.py`), em ritmo 0,95.
   3. **Música e efeitos:** sintetizados (`scripts/reel/audio.py`, adaptado do `3-audio.py` dos vídeos da barbearia), com a música abaixando automaticamente durante a fala (ducking) e volume normalizado em −14 LUFS.
   4. **Animação:** `scripts/reel/composicao.html`, 1080×1920 a 30 fps, desenhada quadro a quadro com `window.renderFrame(t)`, como nos vídeos anteriores. As cenas se distribuem pela duração da narração:
      - abertura com o brasão e o selo;
      - título em Cinzel dourado palavra por palavra;
      - subtítulo;
      - tópicos com losango, um a um;
      - cartão final com o CTA, "@armag.soft" e "link na bio".
   5. **MP4:** H.264 high, AAC 192k, `+faststart`, entre 12 e 20 s.
   6. Sobe o vídeo em `instagram/reels/AAAA-MM-DD/<id>.mp4` e a capa (o 1º quadro do cartão do título) em `…/<id>-capa.jpg`.
   7. Grava `video_url` e `image_url` (capa) e muda o status para `rascunho`.
   8. Em erro: `status='erro'` com a mensagem.
3. Tempo-limite do job: 15 min.

### Rotas
- `POST /api/criativos/gerar` aceita `{ formato? }`. Sem formato, usa o do próximo dia livre. No reel, grava o criativo com `status='renderizando'` e dispara o workflow.
- `PATCH /api/criativos/[id]` também edita o `roteiro`. No reel, volta para `renderizando` e dispara de novo.
- `GET /api/criativos?status=...` inclui `renderizando`. A tela consulta a cada 5 s enquanto houver um.
- `GET/PUT /api/horarios` incluem `formato`.

### Agendamento
"Pode postar" escolhe o próximo dia ativo e livre **cujo formato é igual ao do criativo**:
- reel só cai em dia de reel;
- imagem só cai em dia de imagem.

Se não houver dia daquele formato, devolve um erro claro ("Nenhum dia marcado como Reel").

### Publicação de Reels (cron em duas etapas)
**Etapa 1.** Um agendado vencido com `formato='reel'`:
- passa por uma trava `agendado → processando`;
- cria o container (`media_type=REELS`, `video_url`, `caption`, `cover_url`, `share_to_feed=true`);
- grava `container_id`;
- termina, sem esperar o processamento.

**Etapa 2.** Nas chamadas seguintes do cron (a cada 5 min), cada `processando`:
- consulta o `status_code`;
- com `FINISHED`, passa por uma trava `processando → publicando`, faz o `media_publish` e marca `publicado`;
- com `ERROR`/`EXPIRED`, aplica as regras de nova tentativa atuais (volta a `agendado` em 10 min, até 3 vezes);
- se passar de 30 min em `processando`, conta como erro.

Isso garante que nenhuma função passe dos 60 s e que não haja publicação dupla.

`lib/instagram.ts` ganha:
- `criarContainerReel(videoUrl, legenda, capaUrl)`;
- `statusContainer(id)`;
- `publicarContainer(id)`.

A função `publicarImagem` continua igual.

"Publicar agora" em um reel faz a etapa 1 e mostra "Processando no Instagram, sai em alguns minutos". O cron completa a etapa 2.

### Tela
- **Horários:** cada dia ganha a escolha **Imagem / Reel**.
- **Criativo do dia:**
  - selo com o formato;
  - para reel, a prévia é um `<video controls playsInline>` com a capa;
  - enquanto renderiza, aparece "Montando o vídeo… (2 a 4 min)", com consulta automática;
  - o roteiro aparece abaixo da legenda e é editável, com contador de palavras;
  - botão "Gerar como imagem / Gerar como reel" ao lado de "Gerar outro".
- **Agendados e Publicados:** mostram o ícone do formato.

### Configuração nova
**Vercel:**
- `GITHUB_TOKEN_REELS`: token fine-grained, só `ARMAG-SOFTWARE/armag-instagram`, permissão Actions: Read and write.

**GitHub, em Settings → Secrets → Actions:**
- `SUPABASE_URL`;
- `SUPABASE_SERVICE_ROLE_KEY`.

## O que fica para quem implementar
- Detalhes da animação: tempos de cada cena proporcionais à narração e ao tamanho do título.
- Testes (vitest):
  - agendamento por formato;
  - validação do roteiro;
  - transições do cron em duas etapas, com Graph API falsa (`FINISHED`, `IN_PROGRESS`, `ERROR`, tempo-limite de 30 min, trava contra execução paralela).
- Teste real do workflow: rodar `reel.yml` com um criativo de teste no Supabase depois que os secrets existirem. Até lá, validar a montagem localmente com um criativo de exemplo e conferir o MP4.
