create table private.source_admission_control (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default true,
  updated_at timestamptz not null default statement_timestamp()
);

alter table private.source_admission_control enable row level security;

insert into private.source_admission_control(singleton,enabled) values(true,true);

revoke all on table private.source_admission_control from public,anon,authenticated;

create function public.get_source_admission_capability()
returns table(source_audio_admission_enabled boolean)
language sql stable security definer set search_path='' as $$
  select coalesce(
    (select control.enabled from private.source_admission_control control where control.singleton),
    false
  )
$$;

revoke all on function public.get_source_admission_capability() from public;
grant execute on function public.get_source_admission_capability() to anon,authenticated;

create function public.operator_set_source_admission_enabled(p_enabled boolean)
returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if p_enabled is null then
    raise sqlstate '22023' using message='source_admission_invalid_state';
  end if;

  update private.source_admission_control
  set enabled=p_enabled,updated_at=statement_timestamp()
  where singleton;

  if not found then
    raise exception 'source_admission_control_missing';
  end if;

  return p_enabled;
end
$$;

revoke all on function public.operator_set_source_admission_enabled(boolean) from public,anon,authenticated;
grant execute on function public.operator_set_source_admission_enabled(boolean) to service_role;

create or replace function public.reserve_source_asset(p_request_id uuid,p_expected_byte_size bigint,p_filename text,p_declared_media_type text default null,p_client_duration_ms integer default null,p_expected_sha256 text default null)
returns table(asset_id uuid,bucket text,object_path text,expires_at timestamptz,user_remaining_bytes bigint,global_remaining_bytes bigint,capacity_warning boolean)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_asset public.assets%rowtype; v_upload public.asset_uploads%rowtype; v_global public.global_storage_usage%rowtype; v_user public.user_storage_usage%rowtype; v_id uuid;
begin
 if v_actor is null then raise sqlstate 'PT401' using message='asset_unauthenticated'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.status='active' and p.profile_completed_at is not null) then raise sqlstate 'PT403' using message='asset_actor_ineligible'; end if;
 if p_expected_byte_size not between 1 and 47185920 or p_filename is null or btrim(p_filename)='' or char_length(btrim(p_filename))>255 or (p_client_duration_ms is not null and p_client_duration_ms not between 1 and 600000) or (p_expected_sha256 is not null and p_expected_sha256 !~ '^[0-9a-f]{64}$') then raise sqlstate '22023' using message='asset_invalid_declaration'; end if;
 select * into v_upload from public.asset_uploads u where u.owner_id=v_actor and u.request_id=p_request_id;
 if found then
  select * into v_asset from public.assets a where a.id=v_upload.asset_id;
  if v_upload.expected_byte_size<>p_expected_byte_size or v_upload.client_filename<>btrim(p_filename) or v_upload.client_media_type is distinct from nullif(p_declared_media_type,'') or v_upload.client_duration_ms is distinct from p_client_duration_ms or v_upload.expected_sha256 is distinct from p_expected_sha256 then raise sqlstate '23505' using message='asset_request_conflict'; end if;
  select * into v_global from public.global_storage_usage where singleton; select * into v_user from public.user_storage_usage where user_id=v_actor;
  return query select v_asset.id,v_asset.bucket,v_asset.object_path,v_upload.expires_at,209715200-v_user.source_bytes-v_user.reserved_source_bytes,891289600-v_global.source_bytes-v_global.reserved_source_bytes,(v_global.source_bytes+v_global.reserved_source_bytes)>=786432000; return;
 end if;
 if not coalesce((select control.enabled from private.source_admission_control control where control.singleton),false) then raise sqlstate 'PT403' using message='audio_uploads_unavailable'; end if;
 select * into v_global from public.global_storage_usage where singleton for update;
 insert into public.user_storage_usage(user_id) values(v_actor) on conflict do nothing;
 select * into v_user from public.user_storage_usage where user_id=v_actor for update;
 if v_user.source_bytes+v_user.reserved_source_bytes+p_expected_byte_size>209715200 then raise sqlstate 'PT429' using message='asset_user_quota_exceeded'; end if;
 if v_global.source_bytes+v_global.reserved_source_bytes+p_expected_byte_size>891289600 then raise sqlstate 'PT429' using message='asset_global_quota_exceeded'; end if;
 v_id:=gen_random_uuid();
 insert into public.assets(id,owner_id,object_path,original_filename,declared_media_type,reserved_byte_size) values(v_id,v_actor,v_actor::text||'/'||v_id::text||'/source',btrim(p_filename),nullif(p_declared_media_type,''),p_expected_byte_size) returning * into v_asset;
 insert into public.asset_uploads(asset_id,owner_id,request_id,expected_byte_size,expected_sha256,client_duration_ms,client_filename,client_media_type,expires_at) values(v_id,v_actor,p_request_id,p_expected_byte_size,p_expected_sha256,p_client_duration_ms,btrim(p_filename),nullif(p_declared_media_type,''),statement_timestamp()+interval '24 hours') returning * into v_upload;
 update public.global_storage_usage set reserved_source_bytes=reserved_source_bytes+p_expected_byte_size,updated_at=statement_timestamp() where singleton;
 update public.user_storage_usage set reserved_source_bytes=reserved_source_bytes+p_expected_byte_size,updated_at=statement_timestamp() where user_id=v_actor;
 return query select v_id,'source-audio'::text,v_asset.object_path,v_upload.expires_at,209715200-v_user.source_bytes-v_user.reserved_source_bytes-p_expected_byte_size,891289600-v_global.source_bytes-v_global.reserved_source_bytes-p_expected_byte_size,(v_global.source_bytes+v_global.reserved_source_bytes+p_expected_byte_size)>=786432000;
end$$;

comment on table private.source_admission_control is
  'Trusted global prototype authority for admitting new source_audio reservations. MIDI-07 ships enabled; STUDIO-06 may disable it only after parity approval.';
comment on function public.get_source_admission_capability() is
  'Returns the read-only global source-audio admission capability for capability-driven UI.';
comment on function public.operator_set_source_admission_enabled(boolean) is
  'Service-role-only reversible source-admission switch for the documented staged enable/rollback procedure.';
