-- Apply separately from schema.sql. No browser role may read or write login grants.
begin;
create table if not exists public.embed_auth_codes (
 code_hash text primary key,
 partner text not null,
 nonce text not null,
 user_id uuid not null references auth.users on delete cascade,
 discord_id text not null,
 expires_at timestamptz not null,
 unique(user_id,partner,nonce)
);
create index if not exists embed_auth_codes_expiry on public.embed_auth_codes(expires_at);
alter table public.embed_auth_codes enable row level security;
revoke all on public.embed_auth_codes from public, anon, authenticated;
create or replace function public.issue_embed_auth_code(grant_payload jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare
 account_id uuid := (grant_payload->>'user_id')::uuid;
 pending_count integer;
begin
 -- Serialize issuance for this account so concurrent requests cannot bypass the cap.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(account_id::text,0));
 delete from public.embed_auth_codes where expires_at<=clock_timestamp();
 select count(*) into pending_count from public.embed_auth_codes where user_id=account_id;
 if pending_count>=10 and not exists (
  select 1 from public.embed_auth_codes where user_id=account_id
   and partner=grant_payload->>'partner' and nonce=grant_payload->>'nonce'
 ) then raise exception 'Too many pending sign-ins'; end if;
 insert into public.embed_auth_codes(code_hash,partner,nonce,user_id,discord_id,expires_at)
 values(grant_payload->>'code_hash',grant_payload->>'partner',grant_payload->>'nonce',account_id,
  grant_payload->>'discord_id',least((grant_payload->>'expires_at')::timestamptz,clock_timestamp()+interval '60 seconds'))
 on conflict(user_id,partner,nonce) do update
  set code_hash=excluded.code_hash,expires_at=excluded.expires_at,discord_id=excluded.discord_id;
end;
$$;
create or replace function public.redeem_embed_auth_code(wanted_hash text,wanted_partner text,wanted_nonce text)
returns table(user_id uuid,discord_id text) language sql security definer set search_path='' as $$
 delete from public.embed_auth_codes c where c.code_hash=wanted_hash and c.partner=wanted_partner and c.nonce=wanted_nonce and c.expires_at>clock_timestamp()
 returning c.user_id,c.discord_id;
$$;
revoke all on function public.issue_embed_auth_code(jsonb) from public,anon,authenticated;
revoke all on function public.redeem_embed_auth_code(text,text,text) from public,anon,authenticated;
grant execute on function public.issue_embed_auth_code(jsonb) to service_role;
grant execute on function public.redeem_embed_auth_code(text,text,text) to service_role;
commit;
