-- Reels: formato por dia da semana e campos de vídeo nos criativos.

alter table public.horarios_postagem
  add column if not exists formato text not null default 'imagem' check (formato in ('imagem','reel'));
update public.horarios_postagem set formato = 'reel' where dia_semana in (3, 5); -- quarta e sexta

alter table public.criativos
  add column if not exists formato text not null default 'imagem' check (formato in ('imagem','reel')),
  add column if not exists roteiro text,
  add column if not exists video_url text,
  add column if not exists container_id text,
  add column if not exists processando_desde timestamptz;

-- novos estados: renderizando (vídeo sendo montado) e processando (Instagram processando o Reel)
alter table public.criativos drop constraint if exists criativos_status_check;
alter table public.criativos add constraint criativos_status_check
  check (status in ('rascunho','renderizando','agendado','processando','publicando','publicado','erro','cancelado'));
