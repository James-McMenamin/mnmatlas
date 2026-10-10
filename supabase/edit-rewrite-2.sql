-- Map change fields. Safe to run again; existing rows remain readable.
-- Display settings are also checked against the author in the publishing job.
begin;
alter table public.suggestions drop constraint if exists suggestion_payload;
alter table public.suggestions add constraint suggestion_payload check (coalesce(
 jsonb_typeof(payload)='object' and jsonb_typeof(payload->'name')='string'
 and char_length(payload->>'name') between 1 and 100
 and (kind='new-marker' or (not payload ? 'bounty' and (not payload ? 'priority' or kind='edit-label' and jsonb_typeof(payload->'priority')='number')))
 and (not payload ? 'note' or (jsonb_typeof(payload->'note')='string' and char_length(payload->>'note')<=2000))
 and case when kind in ('move-marker','move-label') then
  target_id is not null and jsonb_typeof(payload->'from')='array' and jsonb_typeof(payload->'to')='array'
  and jsonb_array_length(payload->'from')=2 and jsonb_array_length(payload->'to')=2
  and jsonb_typeof(payload->'from'->0)='number' and jsonb_typeof(payload->'from'->1)='number'
  and jsonb_typeof(payload->'to'->0)='number' and jsonb_typeof(payload->'to'->1)='number'
 when kind in ('edit-marker','edit-label') then
  target_id is not null and jsonb_typeof(payload->'from')='object' and jsonb_typeof(payload->'from'->'name')='string'
  and char_length(payload->'from'->>'name')<=100
  and (not payload->'from' ? 'note' or (jsonb_typeof(payload->'from'->'note')='string' and char_length(payload->'from'->>'note')<=2000))
 when kind='report' then
  target_id is not null and payload->>'reason' in ('position','name','type','missing','other')
  and jsonb_typeof(payload->'x')='number' and jsonb_typeof(payload->'y')='number'
 else
  target_id is null and jsonb_typeof(payload->'x')='number' and jsonb_typeof(payload->'y')='number'
  and jsonb_typeof(payload->'category')='string' and char_length(payload->>'category') between 1 and 80
  and (not payload ? 'noteType' or payload->>'noteType' in ('marker','label','exit'))
  and (not payload ? 'arrow' or payload->>'arrow' in ('up','down','north','northeast','east','southeast','south','southwest','west','northwest'))
  and (not payload ? 'trade' or (jsonb_typeof(payload->'trade')='string' and char_length(payload->>'trade')<=80))
  and (not payload ? 'color' or payload->>'color' in ('#a04438','#b5861f','#4f7a3a','#385f60','#2f6f9a','#6a4a7a','#6b4f2e','#4d5560'))
 end,false)) not valid;
commit;
