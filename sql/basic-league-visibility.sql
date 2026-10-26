alter table public.acl_basic_home_settings
  add column if not exists league_enabled boolean not null default true;
