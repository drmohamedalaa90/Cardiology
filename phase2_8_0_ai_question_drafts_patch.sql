-- ACL Expert Edition V2 — Phase 2.8.0
-- AI question generation review queue.
-- Generated questions remain pending until an administrator reviews and saves them.

create extension if not exists pgcrypto;

create table if not exists public.ai_question_drafts (
  id uuid primary key default gen_random_uuid(),
  module_id text not null references public.modules(id) on delete cascade,
  prompt text not null,
  reference_context text,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  linked_question_id uuid references public.questions(id) on delete set null
);

create index if not exists ai_question_drafts_status_created_idx
  on public.ai_question_drafts(status, created_at desc);

create index if not exists ai_question_drafts_module_idx
  on public.ai_question_drafts(module_id, created_at desc);

alter table public.ai_question_drafts enable row level security;

drop policy if exists "Admins manage AI question drafts" on public.ai_question_drafts;
create policy "Admins manage AI question drafts"
on public.ai_question_drafts
for all
to authenticated
using (public.acl_is_admin())
with check (public.acl_is_admin());

grant select, insert, update, delete
on public.ai_question_drafts
to authenticated;
