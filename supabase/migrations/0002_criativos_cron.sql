-- Chama a publicação dos criativos agendados a cada 5 minutos (pg_cron + pg_net do Supabase).
--
-- ANTES DE RODAR, troque:
--   SEU-DOMINIO      → o domínio de PRODUÇÃO do app na Vercel (ex.: armag-instagram.vercel.app).
--                      Não use a URL de um deploy específico: ela é protegida pela Vercel Authentication.
--   SEU_CRON_SECRET  → o mesmo valor da variável CRON_SECRET configurada na Vercel.
--
-- Para trocar depois: select cron.unschedule('armag-publicar-agendados'); e rode de novo.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'armag-publicar-agendados',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://SEU-DOMINIO.vercel.app/api/cron/publicar',
    headers := jsonb_build_object('Authorization', 'Bearer ' || 'SEU_CRON_SECRET')
  );
  $$
);
