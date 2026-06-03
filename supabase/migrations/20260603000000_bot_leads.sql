create table if not exists public.bot_leads (
  id uuid primary key default gen_random_uuid(),
  email text,
  answers jsonb,
  source text default 'onboarding_bot',
  created_at timestamptz default now()
);

alter table public.bot_leads enable row level security;

create policy "Service role only" on public.bot_leads
  for all using (auth.role() = 'service_role');
