create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table private.asset_verification_jobs (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  state text not null default 'pending' check (state in ('pending', 'leased', 'retry_wait', 'succeeded', 'permanent_failed', 'dead')),
  attempts smallint not null default 0 check (attempts between 0 and 2),
  next_attempt_at timestamptz not null default statement_timestamp(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text check (last_error_code is null or last_error_code ~ '^[a-z][a-z0-9_]{0,63}$'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint asset_verification_jobs_lease_check check (
    (state = 'leased' and lease_token is not null and lease_expires_at is not null)
    or (state <> 'leased' and lease_token is null and lease_expires_at is null)
  ),
  constraint asset_verification_jobs_terminal_check check (
    (state in ('succeeded', 'permanent_failed') and completed_at is not null)
    or (state not in ('succeeded', 'permanent_failed') and completed_at is null)
  )
);

create index asset_verification_jobs_eligible_idx
  on private.asset_verification_jobs (next_attempt_at, created_at)
  where state in ('pending', 'retry_wait', 'leased');
create index asset_verification_jobs_owner_idx
  on private.asset_verification_jobs (owner_id, created_at desc);

alter table private.asset_verification_jobs enable row level security;
revoke all on private.asset_verification_jobs from public, anon, authenticated;

insert into private.asset_verification_jobs (asset_id, owner_id)
select id, owner_id
from public.assets
where kind = 'source_audio' and status = 'processing'
on conflict (asset_id) do nothing;

create or replace function public.complete_source_upload(p_asset_id uuid)
returns public.asset_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_asset public.assets%rowtype;
  v_size bigint;
begin
  select * into v_asset
  from public.assets a
  where a.id = p_asset_id and a.owner_id = v_actor
  for update;

  if not found then
    raise sqlstate 'PT404' using message = 'asset_not_found';
  end if;

  if v_asset.status = 'processing' then
    insert into private.asset_verification_jobs (asset_id, owner_id)
    values (v_asset.id, v_asset.owner_id)
    on conflict (asset_id) do nothing;
    return v_asset.status;
  end if;

  if v_asset.status not in ('reserved', 'uploading') then
    raise sqlstate 'PT409' using message = 'asset_not_completable';
  end if;

  select (metadata ->> 'size')::bigint into v_size
  from storage.objects
  where bucket_id = v_asset.bucket and name = v_asset.object_path;

  if v_size is null then
    raise sqlstate 'PT409' using message = 'asset_object_missing';
  end if;
  if v_size <> v_asset.reserved_byte_size then
    raise sqlstate 'PT409' using message = 'asset_size_mismatch';
  end if;

  update public.assets
  set status = 'processing', upload_completed_at = statement_timestamp()
  where id = p_asset_id;

  insert into private.asset_verification_jobs (asset_id, owner_id)
  values (v_asset.id, v_asset.owner_id);

  return 'processing'::public.asset_status;
end
$$;

create function public.get_source_verification_status(p_asset_id uuid)
returns table (
  asset_status public.asset_status,
  verification_state text,
  attempt_count smallint,
  next_attempt_at timestamptz,
  failure_code text,
  media_type text,
  byte_size bigint,
  duration_ms integer,
  sample_rate_hz integer,
  channels smallint
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'asset_unauthenticated';
  end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message = 'asset_actor_ineligible';
  end if;
  if not exists (
    select 1 from public.assets a where a.id = p_asset_id and a.owner_id = v_actor
  ) then
    raise sqlstate 'PT404' using message = 'asset_not_found';
  end if;

  return query
  select
    a.status,
    case
      when a.status = 'ready' then 'ready'
      when a.status = 'failed' then 'failed'
      when j.state = 'leased' and j.lease_expires_at > statement_timestamp() then 'verifying'
      when j.state = 'retry_wait' then 'retrying'
      when j.state = 'dead' then 'dead'
      when j.state in ('pending', 'leased') and j.created_at < statement_timestamp() - interval '30 seconds' then 'delayed'
      else 'queued'
    end,
    coalesce(j.attempts, 0)::smallint,
    j.next_attempt_at,
    a.failure_code,
    a.media_type,
    a.byte_size,
    a.duration_ms,
    a.sample_rate_hz,
    a.channels
  from public.assets a
  left join private.asset_verification_jobs j on j.asset_id = a.id
  where a.id = p_asset_id and a.owner_id = v_actor;
end
$$;

create function public.retry_source_verification(p_asset_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_job private.asset_verification_jobs%rowtype;
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'asset_unauthenticated';
  end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message = 'asset_actor_ineligible';
  end if;

  select j.* into v_job
  from private.asset_verification_jobs j
  join public.assets a on a.id = j.asset_id
  where j.asset_id = p_asset_id and j.owner_id = v_actor and a.status = 'processing'
  for update of j;

  if not found then
    raise sqlstate 'PT404' using message = 'asset_not_found';
  end if;
  if v_job.state <> 'dead' then
    return v_job.state;
  end if;
  if v_job.updated_at > statement_timestamp() - interval '30 seconds' then
    raise sqlstate 'PT429' using message = 'asset_verification_retry_cooldown';
  end if;

  update private.asset_verification_jobs
  set state = 'pending', attempts = 0, next_attempt_at = statement_timestamp(),
      last_error_code = null, updated_at = statement_timestamp()
  where asset_id = p_asset_id;
  return 'pending';
end
$$;

create function public.operator_claim_source_verification(
  p_asset_id uuid default null,
  p_owner_id uuid default null
)
returns table (
  asset_id uuid,
  owner_id uuid,
  bucket text,
  object_path text,
  original_filename text,
  reserved_byte_size bigint,
  lease_token uuid,
  attempt_count smallint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset_id uuid;
  v_token uuid := gen_random_uuid();
begin
  select j.asset_id into v_asset_id
  from private.asset_verification_jobs j
  join public.assets a on a.id = j.asset_id
  where (p_asset_id is null or j.asset_id = p_asset_id)
    and (p_owner_id is null or j.owner_id = p_owner_id)
    and a.status = 'processing'
    and j.attempts < 2
    and (
      (j.state in ('pending', 'retry_wait') and j.next_attempt_at <= statement_timestamp())
      or (j.state = 'leased' and j.lease_expires_at <= statement_timestamp())
    )
  order by j.next_attempt_at, j.created_at
  for update of j skip locked
  limit 1;

  if v_asset_id is null then
    return;
  end if;

  update private.asset_verification_jobs j
  set state = 'leased', attempts = attempts + 1, lease_token = v_token,
      lease_expires_at = statement_timestamp() + interval '2 minutes',
      started_at = coalesce(started_at, statement_timestamp()),
      updated_at = statement_timestamp()
  where j.asset_id = v_asset_id;

  return query
  select a.id, a.owner_id, a.bucket, a.object_path, a.original_filename,
         a.reserved_byte_size, j.lease_token, j.attempts
  from public.assets a
  join private.asset_verification_jobs j on j.asset_id = a.id
  where a.id = v_asset_id;
end
$$;

create function public.operator_complete_source_verification(
  p_asset_id uuid,
  p_lease_token uuid,
  p_media_type text,
  p_byte_size bigint,
  p_sha256 text,
  p_duration_ms integer,
  p_sample_rate_hz integer,
  p_channels smallint,
  p_verification_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job private.asset_verification_jobs%rowtype;
begin
  select * into v_job from private.asset_verification_jobs
  where asset_id = p_asset_id for update;
  if not found or v_job.state <> 'leased' or v_job.lease_token <> p_lease_token
     or v_job.lease_expires_at <= statement_timestamp() then
    raise exception 'asset_verification_lease_invalid';
  end if;

  perform private.promote_source_asset(
    p_asset_id, p_media_type, p_byte_size, p_sha256, p_duration_ms,
    p_sample_rate_hz, p_channels, p_verification_version
  );
  update private.asset_verification_jobs
  set state = 'succeeded', lease_token = null, lease_expires_at = null,
      last_error_code = null, completed_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where asset_id = p_asset_id;
end
$$;

create function public.operator_fail_source_verification(
  p_asset_id uuid,
  p_lease_token uuid,
  p_failure_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job private.asset_verification_jobs%rowtype;
begin
  if p_failure_code !~ '^[a-z][a-z0-9_]{0,63}$' then
    raise exception 'asset_verification_failure_code_invalid';
  end if;
  select * into v_job from private.asset_verification_jobs
  where asset_id = p_asset_id for update;
  if not found or v_job.state <> 'leased' or v_job.lease_token <> p_lease_token
     or v_job.lease_expires_at <= statement_timestamp() then
    raise exception 'asset_verification_lease_invalid';
  end if;

  perform private.fail_source_asset(p_asset_id, p_failure_code);
  update private.asset_verification_jobs
  set state = 'permanent_failed', lease_token = null, lease_expires_at = null,
      last_error_code = p_failure_code, completed_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where asset_id = p_asset_id;
end
$$;

create function public.operator_retry_source_verification(
  p_asset_id uuid,
  p_lease_token uuid,
  p_error_code text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job private.asset_verification_jobs%rowtype;
  v_state text;
begin
  if p_error_code !~ '^[a-z][a-z0-9_]{0,63}$' then
    raise exception 'asset_verification_error_code_invalid';
  end if;
  select * into v_job from private.asset_verification_jobs
  where asset_id = p_asset_id for update;
  if not found or v_job.state <> 'leased' or v_job.lease_token <> p_lease_token then
    raise exception 'asset_verification_lease_invalid';
  end if;

  v_state := case when v_job.attempts >= 2 then 'dead' else 'retry_wait' end;
  update private.asset_verification_jobs
  set state = v_state, lease_token = null, lease_expires_at = null,
      next_attempt_at = case
        when v_state = 'retry_wait' then statement_timestamp() + interval '10 seconds'
        else statement_timestamp()
      end,
      last_error_code = p_error_code, updated_at = statement_timestamp()
  where asset_id = p_asset_id;
  return v_state;
end
$$;

create function private.invoke_asset_verification_recovery()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_anon_key text;
  v_recovery_secret text;
  v_request_id bigint;
begin
  if not exists (
    select 1
    from private.asset_verification_jobs j
    join public.assets a on a.id = j.asset_id
    where a.status = 'processing' and j.attempts < 2
      and (
        (j.state in ('pending', 'retry_wait') and j.next_attempt_at <= statement_timestamp())
        or (j.state = 'leased' and j.lease_expires_at <= statement_timestamp())
      )
  ) then
    return null;
  end if;

  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'asset_verification_recovery_url';
  select decrypted_secret into v_anon_key
  from vault.decrypted_secrets where name = 'asset_verification_anon_key';
  select decrypted_secret into v_recovery_secret
  from vault.decrypted_secrets where name = 'asset_verification_recovery_secret';
  if v_url is null or v_anon_key is null or v_recovery_secret is null then
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_anon_key,
      'x-verification-recovery-secret', v_recovery_secret,
      'x-region', 'us-west-2',
      'Content-Type', 'application/json'
    ),
    body := '{"mode":"recover"}'::jsonb,
    timeout_milliseconds := 5000
  ) into v_request_id;
  return v_request_id;
end
$$;

create function private.prune_asset_verification_history()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.asset_verification_jobs
  where state in ('succeeded', 'permanent_failed')
    and completed_at < statement_timestamp() - interval '7 days';
  delete from cron.job_run_details
  where end_time < statement_timestamp() - interval '7 days';
end
$$;

select cron.schedule(
  'asset-verification-recovery',
  '* * * * *',
  $$select private.invoke_asset_verification_recovery()$$
);
select cron.schedule(
  'asset-verification-history-prune',
  '17 4 * * *',
  $$select private.prune_asset_verification_history()$$
);

revoke execute on function public.get_source_verification_status(uuid), public.retry_source_verification(uuid)
from public, anon;
grant execute on function public.get_source_verification_status(uuid), public.retry_source_verification(uuid)
to authenticated;

revoke all on function public.operator_claim_source_verification(uuid, uuid),
  public.operator_complete_source_verification(uuid, uuid, text, bigint, text, integer, integer, smallint, text),
  public.operator_fail_source_verification(uuid, uuid, text),
  public.operator_retry_source_verification(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.operator_claim_source_verification(uuid, uuid),
  public.operator_complete_source_verification(uuid, uuid, text, bigint, text, integer, integer, smallint, text),
  public.operator_fail_source_verification(uuid, uuid, text),
  public.operator_retry_source_verification(uuid, uuid, text)
to service_role;

revoke all on function private.invoke_asset_verification_recovery(),
  private.prune_asset_verification_history()
from public, anon, authenticated;
