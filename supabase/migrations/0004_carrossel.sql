-- Carrosséis: terceiro formato (imagem | carrossel | reel), slides e imagens de cada slide.

alter table public.horarios_postagem drop constraint if exists horarios_postagem_formato_check;
alter table public.horarios_postagem add constraint horarios_postagem_formato_check check (formato in ('imagem','carrossel','reel'));
-- semana sugerida: seg imagem · ter carrossel · qua reel · qui carrossel · sex reel · sáb imagem
update public.horarios_postagem set formato = 'carrossel' where dia_semana in (2, 4);

alter table public.criativos drop constraint if exists criativos_formato_check;
alter table public.criativos add constraint criativos_formato_check check (formato in ('imagem','carrossel','reel'));
alter table public.criativos
  add column if not exists slides jsonb not null default '[]',   -- [{ "titulo": "...", "texto": "..." }] (slides de conteúdo)
  add column if not exists imagens jsonb not null default '[]';  -- URLs públicas de cada slide, na ordem
