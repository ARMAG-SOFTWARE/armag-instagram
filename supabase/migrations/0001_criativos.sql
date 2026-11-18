-- Tela /criativos: horários de postagem por dia da semana e criativos (rascunho → agendado → publicado).

create table if not exists public.horarios_postagem (
  dia_semana smallint primary key check (dia_semana between 0 and 6), -- 0=domingo ... 6=sábado
  hora time not null,
  ativo boolean not null default true
);

insert into public.horarios_postagem (dia_semana, hora, ativo) values
  (0, '10:00', false),  -- domingo (desligado)
  (1, '12:00', true),   -- segunda
  (2, '12:00', true),   -- terça
  (3, '12:00', true),   -- quarta
  (4, '12:00', true),   -- quinta
  (5, '12:00', true),   -- sexta
  (6, '10:00', true)    -- sábado
on conflict (dia_semana) do nothing;
-- (valores iniciais editáveis pela tela)

create table if not exists public.criativos (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  tipo text not null check (tipo in ('Serviço','Dica')),
  titulo text not null,
  titulo_px int,
  subtitulo text not null,
  itens jsonb not null default '[]',
  cta text not null,
  legenda text not null,
  tema text not null,                        -- resumo curto do tema, para não repetir
  image_url text,
  status text not null default 'rascunho'
    check (status in ('rascunho','agendado','publicando','publicado','erro','cancelado')),
  agendado_para timestamptz,
  publicado_em timestamptz,
  media_id text,
  permalink text,
  erro text,
  tentativas int not null default 0
);

create index if not exists criativos_status_agendado_idx on public.criativos (status, agendado_para);
alter table public.criativos enable row level security;
alter table public.horarios_postagem enable row level security;
-- sem policies públicas: só o servidor (service role) acessa
