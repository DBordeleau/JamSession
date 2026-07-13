-- PR 17: bounded profile/dashboard navigation, throttled activity, and avatars.

alter table public.profiles
  add column avatar_version_id uuid,
  add column avatar_path text,
  add column avatar_updated_at timestamptz,
  add constraint profiles_avatar_pair_check check (
    (avatar_version_id is null) = (avatar_path is null)
  ),
  add constraint profiles_avatar_path_check check (
    avatar_path is null or avatar_path ~ ('^' || id::text || '/[0-9a-f-]{36}/avatar[.]webp$')
  );

alter table public.assets
  add column image_width integer,
  add column image_height integer,
  add column frame_count smallint;

alter table public.assets drop constraint assets_kind_storage_check;
alter table public.assets drop constraint assets_path_check;
alter table public.assets drop constraint assets_reserved_size_check;
alter table public.assets drop constraint assets_ready_check;

alter table public.assets add constraint assets_kind_storage_check check (
  (kind = 'source_audio' and bucket = 'source-audio') or
  (kind = 'workspace_snapshot' and bucket = 'workspace-snapshots') or
  (kind = 'image' and bucket = 'profile-images')
);
alter table public.assets add constraint assets_path_check check (
  (kind = 'source_audio' and object_path = owner_id::text || '/' || id::text || '/source') or
  (kind = 'workspace_snapshot' and object_path ~ ('^' || owner_id::text || '/workspaces/[0-9a-f-]{36}/snapshots/' || id::text || '/manifest-v1[.]json$')) or
  (kind = 'image' and object_path = owner_id::text || '/' || id::text || '/original')
);
alter table public.assets add constraint assets_reserved_size_check check (
  (kind = 'source_audio' and reserved_byte_size between 1 and 47185920) or
  (kind = 'workspace_snapshot' and reserved_byte_size between 1 and 65536) or
  (kind = 'image' and reserved_byte_size between 1 and 5242880)
);
alter table public.assets add constraint assets_ready_check check (
  (
    status = 'ready' and failure_code is null and failed_at is null and ready_at is not null and
    (
      (kind = 'source_audio' and media_type in ('audio/wav','audio/flac','audio/mpeg') and byte_size between 1 and 47185920 and sha256 is not null and duration_ms between 1 and 600000 and sample_rate_hz between 8000 and 192000 and channels between 1 and 8 and verification_version is not null and image_width is null and image_height is null and frame_count is null) or
      (kind = 'workspace_snapshot' and media_type = 'application/json' and byte_size between 1 and 65536 and sha256 is not null and duration_ms is null and sample_rate_hz is null and channels is null and verification_version is not null and image_width is null and image_height is null and frame_count is null) or
      (kind = 'image' and media_type in ('image/jpeg','image/png','image/webp') and byte_size between 1 and 5242880 and sha256 is not null and duration_ms is null and sample_rate_hz is null and channels is null and verification_version = 'profile-image-v1' and image_width between 128 and 4096 and image_height between 128 and 4096 and image_width::bigint * image_height::bigint <= 16777216 and frame_count = 1)
    )
  ) or
  (status <> 'ready' and ready_at is null)
);

create type public.profile_avatar_status as enum (
  'processing', 'current', 'superseded', 'removed', 'failed', 'cleaned'
);

create table public.profile_avatar_versions (
  id uuid primary key,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  source_asset_id uuid not null unique references public.assets(id) on delete restrict,
  public_object_path text not null unique,
  status public.profile_avatar_status not null default 'processing',
  media_type text,
  byte_size integer,
  sha256 text,
  width integer,
  height integer,
  created_at timestamptz not null default statement_timestamp(),
  installed_at timestamptz,
  superseded_at timestamptz,
  cleaned_at timestamptz,
  constraint profile_avatar_path_check check (
    public_object_path = profile_id::text || '/' || id::text || '/avatar.webp'
  ),
  constraint profile_avatar_output_check check (
    (status in ('current','superseded','removed') and media_type = 'image/webp' and byte_size between 1 and 524288 and sha256 ~ '^[0-9a-f]{64}$' and width = 512 and height = 512 and installed_at is not null)
    or (status in ('processing','failed','cleaned'))
  )
);
create unique index profile_avatar_versions_current_uq
  on public.profile_avatar_versions(profile_id) where status = 'current';
create index profile_avatar_versions_profile_created_idx
  on public.profile_avatar_versions(profile_id, created_at desc);

alter table public.profiles add constraint profiles_avatar_version_fk
  foreign key (avatar_version_id) references public.profile_avatar_versions(id) on delete restrict;

create table private.profile_image_uploads (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  avatar_version_id uuid not null unique references public.profile_avatar_versions(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null,
  expected_byte_size integer not null check(expected_byte_size between 1 and 5242880),
  declared_media_type text not null check(declared_media_type in ('image/jpeg','image/png','image/webp')),
  expires_at timestamptz not null,
  upload_completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique(owner_id, request_id)
);

create table private.profile_image_processing_jobs (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  avatar_version_id uuid not null unique references public.profile_avatar_versions(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','leased','retry','complete','dead')),
  attempt_count integer not null default 0 check(attempt_count between 0 and 5),
  next_attempt_at timestamptz not null default statement_timestamp(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text,
  updated_at timestamptz not null default statement_timestamp()
);
create index profile_image_processing_due_idx
  on private.profile_image_processing_jobs(next_attempt_at, asset_id)
  where status in ('pending','retry');

create table private.profile_avatar_cleanup_jobs (
  avatar_version_id uuid primary key references public.profile_avatar_versions(id) on delete cascade,
  source_asset_id uuid not null references public.assets(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  public_object_path text not null,
  private_object_path text not null,
  status text not null default 'pending' check(status in ('pending','leased','retry','complete','dead')),
  attempt_count integer not null default 0 check(attempt_count between 0 and 8),
  next_attempt_at timestamptz not null default statement_timestamp(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text,
  updated_at timestamptz not null default statement_timestamp()
);
create index profile_avatar_cleanup_due_idx
  on private.profile_avatar_cleanup_jobs(next_attempt_at, avatar_version_id)
  where status in ('pending','retry');

alter table public.profile_avatar_versions enable row level security;
alter table private.profile_image_uploads enable row level security;
alter table private.profile_image_processing_jobs enable row level security;
alter table private.profile_avatar_cleanup_jobs enable row level security;
revoke all on public.profile_avatar_versions from public, anon, authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
  ('profile-images','profile-images',false,5242880,array['image/jpeg','image/png','image/webp']),
  ('public-avatars','public-avatars',true,524288,array['image/webp'])
on conflict(id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace view public.public_profiles
with (security_invoker = true)
as
select id, username, username_normalized, display_name, credit_name, bio,
  created_at, updated_at, avatar_path, avatar_version_id
from public.profiles;

grant select on public.public_profiles to anon, authenticated;
grant select(avatar_path,avatar_version_id) on public.profiles to anon,authenticated;

create function public.touch_viewer_activity()
returns table(last_active_at timestamptz, touched boolean)
language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_touched boolean := false;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='activity_unauthenticated'; end if;
  if not exists(select 1 from public.profiles where id=v_actor and status='active' and profile_completed_at is not null) then
    raise sqlstate 'PT403' using message='activity_forbidden';
  end if;
  update public.profiles set last_active_at=statement_timestamp()
  where id=v_actor and (profiles.last_active_at is null or profiles.last_active_at < statement_timestamp() - interval '15 minutes');
  v_touched := found;
  return query select p.last_active_at, v_touched from public.profiles p where p.id=v_actor;
end $$;
revoke all on function public.touch_viewer_activity() from public, anon;
grant execute on function public.touch_viewer_activity() to authenticated;

create function public.get_viewer_dashboard()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise sqlstate 'PT401' using message='dashboard_unauthenticated'; end if;
  if not exists(select 1 from public.profiles where id=v_actor and status='active' and profile_completed_at is not null) then
    raise sqlstate 'PT403' using message='dashboard_forbidden';
  end if;
  return jsonb_build_object(
    'ownedProjects', coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at desc,x.project_id desc) from (
      select p.id project_id,p.title,p.status,p.current_revision_id,p.updated_at
      from public.projects p where p.owner_id=v_actor and p.deleted_at is null and p.status in ('draft','active')
      order by p.updated_at desc,p.id desc limit 7) x),'[]'::jsonb),
    'activeWorkspaces', coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at desc,x.workspace_id desc) from (
      select w.id workspace_id,w.project_id,p.title project_title,w.contribution_id,c.title contribution_title,w.lock_version,w.updated_at
      from public.workspaces w join public.projects p on p.id=w.project_id left join public.contributions c on c.id=w.contribution_id
      where w.owner_id=v_actor and w.status='active' and p.deleted_at is null
      order by w.updated_at desc,w.id desc limit 7) x),'[]'::jsonb),
    'pendingContributions', coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at desc,x.contribution_id desc) from (
      select c.id contribution_id,c.project_id,p.title project_title,c.title,c.status,c.current_version_id,
        cv.version_number current_version_number,c.updated_at
      from public.contributions c join public.projects p on p.id=c.project_id
      left join public.contribution_versions cv on cv.id=c.current_version_id
      where c.author_id=v_actor and c.status in ('draft','submitted','changes_requested') and p.deleted_at is null
      order by c.updated_at desc,c.id desc limit 7) x),'[]'::jsonb),
    'review', (select jsonb_build_object('count',least(count(*),99),'hasMore',count(*)=100) from (
      select c.id from public.contributions c join public.projects p on p.id=c.project_id
      where p.owner_id=v_actor and p.deleted_at is null and c.status='submitted' limit 100) q)
  );
end $$;
revoke all on function public.get_viewer_dashboard() from public, anon;
grant execute on function public.get_viewer_dashboard() to authenticated;

create function public.list_viewer_projects(
  p_scope text default 'all', p_review boolean default false,
  p_after_updated_at timestamptz default null, p_after_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise sqlstate 'PT401' using message='projects_unauthenticated'; end if;
  if p_scope not in ('all','owned') or (p_review and p_scope <> 'owned') or ((p_after_updated_at is null) <> (p_after_id is null)) then
    raise sqlstate 'PT400' using message='projects_query_invalid';
  end if;
  if not exists(select 1 from public.profiles where id=v_actor and status='active' and profile_completed_at is not null) then
    raise sqlstate 'PT403' using message='projects_forbidden';
  end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at desc,x.project_id desc) from (
    select p.id project_id,p.title,p.description,p.status,p.current_revision_id,p.updated_at,m.role,
      exists(select 1 from public.contributions c where c.project_id=p.id and c.status='submitted') needs_review
    from public.projects p join public.project_members m on m.project_id=p.id and m.user_id=v_actor
    where p.deleted_at is null and p.status <> 'deleted'
      and (p_scope='all' or p.owner_id=v_actor)
      and (not p_review or exists(select 1 from public.contributions c where c.project_id=p.id and c.status='submitted'))
      and (p_after_updated_at is null or (p.updated_at,p.id) < (p_after_updated_at,p_after_id))
    order by p.updated_at desc,p.id desc limit 25) x),'[]'::jsonb);
end $$;
revoke all on function public.list_viewer_projects(text,boolean,timestamptz,uuid) from public, anon;
grant execute on function public.list_viewer_projects(text,boolean,timestamptz,uuid) to authenticated;

create function public.list_viewer_contributions(
  p_status text default 'active', p_after_updated_at timestamptz default null, p_after_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise sqlstate 'PT401' using message='contributions_unauthenticated'; end if;
  if p_status not in ('active','submitted','history') or ((p_after_updated_at is null) <> (p_after_id is null)) then
    raise sqlstate 'PT400' using message='contributions_query_invalid';
  end if;
  if not exists(select 1 from public.profiles where id=v_actor and status='active' and profile_completed_at is not null) then
    raise sqlstate 'PT403' using message='contributions_forbidden';
  end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at desc,x.contribution_id desc) from (
    select c.id contribution_id,c.project_id,p.title project_title,c.title,c.status,c.base_revision_id,c.current_version_id,
      cv.version_number current_version_number,c.updated_at,
      case when c.author_id=v_actor then 'author' else 'reviewer' end viewer_relationship
    from public.contributions c join public.projects p on p.id=c.project_id
    left join public.contribution_versions cv on cv.id=c.current_version_id
    where p.deleted_at is null and (c.author_id=v_actor or (p.owner_id=v_actor and c.status <> 'draft'))
      and ((p_status='active' and c.status in ('draft','submitted','changes_requested')) or
           (p_status='submitted' and c.status='submitted') or
           (p_status='history' and c.status in ('accepted','rejected','withdrawn')))
      and (p_after_updated_at is null or (c.updated_at,c.id) < (p_after_updated_at,p_after_id))
    order by c.updated_at desc,c.id desc limit 25) x),'[]'::jsonb);
end $$;
revoke all on function public.list_viewer_contributions(text,timestamptz,uuid) from public, anon;
grant execute on function public.list_viewer_contributions(text,timestamptz,uuid) to authenticated;

create function public.list_public_profile_projects(
  p_profile_id uuid, p_discovery_version bigint,
  p_after_published_at timestamptz default null, p_after_project_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if ((p_after_published_at is null) <> (p_after_project_id is null)) then raise sqlstate 'PT400' using message='profile_cursor_invalid'; end if;
  if not exists(select 1 from public.discovery_state where singleton and version=p_discovery_version) then raise sqlstate 'PT409' using message='profile_cursor_stale'; end if;
  if not exists(select 1 from public.public_profiles where id=p_profile_id) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('projectId',c.project_id,'title',c.title,'publishedAt',c.published_at)
    order by c.published_at desc,c.project_id desc)
    from (select * from public.public_project_catalog where owner_id=p_profile_id
      and (p_after_published_at is null or (published_at,project_id)<(p_after_published_at,p_after_project_id))
      order by published_at desc,project_id desc limit 13) c),'[]'::jsonb);
end $$;
revoke all on function public.list_public_profile_projects(uuid,bigint,timestamptz,uuid) from public;
grant execute on function public.list_public_profile_projects(uuid,bigint,timestamptz,uuid) to anon, authenticated;

create function public.list_public_profile_contributions(
  p_profile_id uuid, p_discovery_version bigint,
  p_after_accepted_at timestamptz default null, p_after_revision_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if ((p_after_accepted_at is null) <> (p_after_revision_id is null)) then raise sqlstate 'PT400' using message='profile_cursor_invalid'; end if;
  if not exists(select 1 from public.discovery_state where singleton and version=p_discovery_version) then raise sqlstate 'PT409' using message='profile_cursor_stale'; end if;
  if not exists(select 1 from public.public_profiles where id=p_profile_id) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('projectId',x.project_id,'projectTitle',x.title,'revisionId',x.revision_id,'revisionNumber',x.revision_number,'creditName',x.credit_name,'acceptedAt',x.created_at)
    order by x.created_at desc,x.revision_id desc) from (
    select c.project_id,c.title,r.id revision_id,r.revision_number,ra.credit_name,ra.created_at
    from public.revision_attributions ra join public.project_revisions r on r.id=ra.revision_id
    join public.public_project_catalog c on c.project_id=r.project_id
    where ra.kind='accepted_contributor' and ra.user_id=p_profile_id
      and (p_after_accepted_at is null or (ra.created_at,r.id)<(p_after_accepted_at,p_after_revision_id))
    order by ra.created_at desc,r.id desc limit 13) x),'[]'::jsonb);
end $$;
revoke all on function public.list_public_profile_contributions(uuid,bigint,timestamptz,uuid) from public;
grant execute on function public.list_public_profile_contributions(uuid,bigint,timestamptz,uuid) to anon, authenticated;

create function private.can_upload_reserved_profile_image(p_bucket text,p_name text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.assets a join private.profile_image_uploads u on u.asset_id=a.id
    where a.owner_id=(select auth.uid()) and a.bucket=p_bucket and a.object_path=p_name
      and a.status in ('reserved','uploading') and u.expires_at>statement_timestamp())
$$;
revoke all on function private.can_upload_reserved_profile_image(text,text) from public,anon;
grant execute on function private.can_upload_reserved_profile_image(text,text) to authenticated;

create function public.reserve_profile_image_upload(p_request_id uuid,p_expected_byte_size integer,p_filename text,p_declared_media_type text)
returns table(asset_id uuid,avatar_version_id uuid,bucket text,object_path text,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_asset uuid:=gen_random_uuid(); v_version uuid:=gen_random_uuid(); v_expiry timestamptz:=statement_timestamp()+interval '30 minutes'; v_existing record;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='avatar_unauthenticated'; end if;
  if not exists(select 1 from public.profiles where id=v_actor and status='active' and profile_completed_at is not null) then raise sqlstate 'PT403' using message='avatar_forbidden'; end if;
  if p_expected_byte_size not between 1 and 5242880 or p_declared_media_type not in ('image/jpeg','image/png','image/webp') or p_filename is null or p_filename<>btrim(p_filename) or char_length(p_filename) not between 1 and 255 then raise sqlstate 'PT400' using message='avatar_invalid'; end if;
  select a.id,u.avatar_version_id,a.bucket,a.object_path,u.expires_at into v_existing from private.profile_image_uploads u join public.assets a on a.id=u.asset_id where u.owner_id=v_actor and u.request_id=p_request_id;
  if found then
    if (select reserved_byte_size from public.assets where id=v_existing.id)<>p_expected_byte_size then raise sqlstate 'PT409' using message='avatar_request_conflict'; end if;
    return query select v_existing.id,v_existing.avatar_version_id,v_existing.bucket,v_existing.object_path,v_existing.expires_at; return;
  end if;
  if exists(select 1 from private.profile_image_uploads u where u.owner_id=v_actor and u.expires_at>statement_timestamp() and u.upload_completed_at is null) then raise sqlstate 'PT429' using message='avatar_upload_in_progress'; end if;
  insert into public.assets(id,owner_id,kind,status,bucket,object_path,original_filename,declared_media_type,reserved_byte_size)
  values(v_asset,v_actor,'image','reserved','profile-images',v_actor::text||'/'||v_asset::text||'/original',p_filename,p_declared_media_type,p_expected_byte_size);
  insert into public.profile_avatar_versions(id,profile_id,source_asset_id,public_object_path)
  values(v_version,v_actor,v_asset,v_actor::text||'/'||v_version::text||'/avatar.webp');
  insert into private.profile_image_uploads(asset_id,avatar_version_id,owner_id,request_id,expected_byte_size,declared_media_type,expires_at)
  values(v_asset,v_version,v_actor,p_request_id,p_expected_byte_size,p_declared_media_type,v_expiry);
  return query select v_asset,v_version,'profile-images'::text,v_actor::text||'/'||v_asset::text||'/original',v_expiry;
end $$;

create function public.complete_profile_image_upload(p_asset_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_version uuid;
begin
  select u.avatar_version_id into v_version from private.profile_image_uploads u join public.assets a on a.id=u.asset_id
    where u.asset_id=p_asset_id and u.owner_id=v_actor and a.status in ('reserved','uploading','processing') and u.expires_at>statement_timestamp() for update of u,a;
  if not found then raise sqlstate 'PT404' using message='avatar_upload_missing'; end if;
  update public.assets set status='processing',upload_completed_at=coalesce(upload_completed_at,statement_timestamp()) where id=p_asset_id and status in ('reserved','uploading');
  update private.profile_image_uploads set upload_completed_at=coalesce(upload_completed_at,statement_timestamp()) where asset_id=p_asset_id;
  insert into private.profile_image_processing_jobs(asset_id,owner_id,avatar_version_id) values(p_asset_id,v_actor,v_version) on conflict(asset_id) do nothing;
  return v_version;
end $$;

revoke all on function public.reserve_profile_image_upload(uuid,integer,text,text),public.complete_profile_image_upload(uuid) from public,anon;
grant execute on function public.reserve_profile_image_upload(uuid,integer,text,text),public.complete_profile_image_upload(uuid) to authenticated;

create function public.operator_claim_profile_image(p_asset_id uuid default null,p_owner_id uuid default null)
returns table(asset_id uuid,owner_id uuid,avatar_version_id uuid,bucket text,object_path text,reserved_byte_size bigint,declared_media_type text,public_object_path text,lease_token uuid,attempt_count integer)
language plpgsql security definer set search_path='' as $$
declare v_job private.profile_image_processing_jobs%rowtype; v_token uuid:=gen_random_uuid();
begin
  select * into v_job from private.profile_image_processing_jobs j where (p_asset_id is null or j.asset_id=p_asset_id) and (p_owner_id is null or j.owner_id=p_owner_id)
    and (j.status in ('pending','retry') and j.next_attempt_at<=statement_timestamp() or (j.status='leased' and j.lease_expires_at<=statement_timestamp()))
    order by j.next_attempt_at,j.asset_id for update skip locked limit 1;
  if not found then return; end if;
  update private.profile_image_processing_jobs set status='leased',attempt_count=profile_image_processing_jobs.attempt_count+1,lease_token=v_token,lease_expires_at=statement_timestamp()+interval '2 minutes',updated_at=statement_timestamp() where profile_image_processing_jobs.asset_id=v_job.asset_id;
  return query select a.id,a.owner_id,v_job.avatar_version_id,a.bucket,a.object_path,a.reserved_byte_size,a.declared_media_type,v.public_object_path,v_token,v_job.attempt_count+1
    from public.assets a join public.profile_avatar_versions v on v.id=v_job.avatar_version_id where a.id=v_job.asset_id;
end $$;

create function public.operator_complete_profile_image(p_asset_id uuid,p_lease_token uuid,p_media_type text,p_byte_size bigint,p_sha256 text,p_width integer,p_height integer,p_frame_count smallint,p_output_byte_size integer,p_output_sha256 text)
returns text language plpgsql security definer set search_path='' as $$
declare v_job private.profile_image_processing_jobs%rowtype; v_old public.profile_avatar_versions%rowtype; v_path text;
begin
  select * into v_job from private.profile_image_processing_jobs where asset_id=p_asset_id for update;
  if not found or v_job.status<>'leased' or v_job.lease_token<>p_lease_token or v_job.lease_expires_at<=statement_timestamp() then raise sqlstate 'PT409' using message='avatar_lease_invalid'; end if;
  if p_media_type not in ('image/jpeg','image/png','image/webp') or p_byte_size not between 1 and 5242880 or p_sha256 !~ '^[0-9a-f]{64}$' or p_width not between 128 and 4096 or p_height not between 128 and 4096 or p_width::bigint*p_height::bigint>16777216 or p_frame_count<>1 or p_output_byte_size not between 1 and 524288 or p_output_sha256 !~ '^[0-9a-f]{64}$' then raise sqlstate 'PT400' using message='avatar_output_invalid'; end if;
  select * into v_old from public.profile_avatar_versions where profile_id=v_job.owner_id and status='current' for update;
  update public.assets set status='ready',media_type=p_media_type,byte_size=p_byte_size,sha256=p_sha256,image_width=p_width,image_height=p_height,frame_count=p_frame_count,verification_version='profile-image-v1',ready_at=statement_timestamp() where id=p_asset_id;
  if v_old.id is not null then
    update public.profile_avatar_versions set status='superseded',superseded_at=statement_timestamp() where id=v_old.id;
  end if;
  update public.profile_avatar_versions set status='current',media_type='image/webp',byte_size=p_output_byte_size,sha256=p_output_sha256,width=512,height=512,installed_at=statement_timestamp() where id=v_job.avatar_version_id returning public_object_path into v_path;
  update public.profiles set avatar_version_id=v_job.avatar_version_id,avatar_path=v_path,avatar_updated_at=statement_timestamp() where id=v_job.owner_id;
  if v_old.id is not null then
    insert into private.profile_avatar_cleanup_jobs(avatar_version_id,source_asset_id,profile_id,public_object_path,private_object_path)
      values(v_old.id,v_old.source_asset_id,v_old.profile_id,v_old.public_object_path,(select object_path from public.assets where id=v_old.source_asset_id)) on conflict do nothing;
  end if;
  update private.profile_image_processing_jobs set status='complete',lease_token=null,lease_expires_at=null,updated_at=statement_timestamp() where asset_id=p_asset_id;
  perform private.bump_discovery_version();
  return v_path;
end $$;

create function public.operator_retry_profile_image(p_asset_id uuid,p_lease_token uuid,p_error_code text)
returns text language plpgsql security definer set search_path='' as $$
declare v_attempt integer;
begin
  select attempt_count into v_attempt from private.profile_image_processing_jobs where asset_id=p_asset_id and status='leased' and lease_token=p_lease_token and lease_expires_at>statement_timestamp() for update;
  if not found then raise sqlstate 'PT409' using message='avatar_lease_invalid'; end if;
  update private.profile_image_processing_jobs set status=case when v_attempt>=5 then 'dead' else 'retry' end,next_attempt_at=statement_timestamp()+make_interval(secs=>least(300,power(2,v_attempt)::integer*5)),lease_token=null,lease_expires_at=null,last_error_code=left(p_error_code,80),updated_at=statement_timestamp() where asset_id=p_asset_id;
  if v_attempt>=5 then update public.profile_avatar_versions set status='failed' where source_asset_id=p_asset_id and status='processing'; update public.assets set status='failed',failure_code=left(p_error_code,80),failed_at=statement_timestamp() where id=p_asset_id; end if;
  return case when v_attempt>=5 then 'dead' else 'retry' end;
end $$;

create function public.operator_claim_profile_avatar_cleanup()
returns table(avatar_version_id uuid,source_asset_id uuid,profile_id uuid,public_object_path text,private_object_path text,lease_token uuid,attempt_count integer)
language plpgsql security definer set search_path='' as $$
declare v_job private.profile_avatar_cleanup_jobs%rowtype; v_token uuid:=gen_random_uuid();
begin
  select * into v_job from private.profile_avatar_cleanup_jobs j
  where (j.status in ('pending','retry') and j.next_attempt_at<=statement_timestamp()) or (j.status='leased' and j.lease_expires_at<=statement_timestamp())
  order by j.next_attempt_at,j.avatar_version_id for update skip locked limit 1;
  if not found then return; end if;
  update private.profile_avatar_cleanup_jobs set status='leased',attempt_count=profile_avatar_cleanup_jobs.attempt_count+1,lease_token=v_token,lease_expires_at=statement_timestamp()+interval '2 minutes',updated_at=statement_timestamp() where profile_avatar_cleanup_jobs.avatar_version_id=v_job.avatar_version_id;
  return query select v_job.avatar_version_id,v_job.source_asset_id,v_job.profile_id,v_job.public_object_path,v_job.private_object_path,v_token,v_job.attempt_count+1;
end $$;

create function public.operator_count_due_profile_avatar_cleanup()
returns bigint language sql stable security definer set search_path='' as $$
  select count(*) from private.profile_avatar_cleanup_jobs
  where (status in ('pending','retry') and next_attempt_at<=statement_timestamp()) or (status='leased' and lease_expires_at<=statement_timestamp())
$$;

create function public.operator_complete_profile_avatar_cleanup(p_avatar_version_id uuid,p_lease_token uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_asset uuid;
begin
  select source_asset_id into v_asset from private.profile_avatar_cleanup_jobs where avatar_version_id=p_avatar_version_id and status='leased' and lease_token=p_lease_token and lease_expires_at>statement_timestamp() for update;
  if not found then raise sqlstate 'PT409' using message='avatar_cleanup_lease_invalid'; end if;
  if exists(select 1 from public.profiles where avatar_version_id=p_avatar_version_id) then raise sqlstate 'PT409' using message='avatar_cleanup_current'; end if;
  update public.profile_avatar_versions set status='cleaned',cleaned_at=statement_timestamp() where id=p_avatar_version_id;
  update public.assets set status='deleted',deleted_at=statement_timestamp() where id=v_asset and kind='image';
  update private.profile_avatar_cleanup_jobs set status='complete',lease_token=null,lease_expires_at=null,updated_at=statement_timestamp() where avatar_version_id=p_avatar_version_id;
end $$;

create function public.operator_retry_profile_avatar_cleanup(p_avatar_version_id uuid,p_lease_token uuid,p_error_code text)
returns text language plpgsql security definer set search_path='' as $$
declare v_attempt integer;
begin
  select attempt_count into v_attempt from private.profile_avatar_cleanup_jobs where avatar_version_id=p_avatar_version_id and status='leased' and lease_token=p_lease_token and lease_expires_at>statement_timestamp() for update;
  if not found then raise sqlstate 'PT409' using message='avatar_cleanup_lease_invalid'; end if;
  update private.profile_avatar_cleanup_jobs set status=case when v_attempt>=8 then 'dead' else 'retry' end,next_attempt_at=statement_timestamp()+make_interval(secs=>least(3600,power(2,v_attempt)::integer*10)),lease_token=null,lease_expires_at=null,last_error_code=left(p_error_code,80),updated_at=statement_timestamp() where avatar_version_id=p_avatar_version_id;
  return case when v_attempt>=8 then 'dead' else 'retry' end;
end $$;

create function public.remove_own_avatar(p_expected_avatar_version_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_old public.profile_avatar_versions%rowtype;
begin
  select v.* into v_old from public.profiles p join public.profile_avatar_versions v on v.id=p.avatar_version_id where p.id=v_actor and p.avatar_version_id=p_expected_avatar_version_id for update of p,v;
  if not found then raise sqlstate 'PT409' using message='avatar_stale'; end if;
  update public.profiles set avatar_version_id=null,avatar_path=null,avatar_updated_at=statement_timestamp() where id=v_actor;
  update public.profile_avatar_versions set status='removed',superseded_at=statement_timestamp() where id=v_old.id;
  insert into private.profile_avatar_cleanup_jobs(avatar_version_id,source_asset_id,profile_id,public_object_path,private_object_path)
    values(v_old.id,v_old.source_asset_id,v_old.profile_id,v_old.public_object_path,(select object_path from public.assets where id=v_old.source_asset_id)) on conflict do nothing;
  perform private.bump_discovery_version();
end $$;

revoke all on function public.remove_own_avatar(uuid) from public,anon;
grant execute on function public.remove_own_avatar(uuid) to authenticated;
revoke all on function public.operator_claim_profile_image(uuid,uuid),public.operator_complete_profile_image(uuid,uuid,text,bigint,text,integer,integer,smallint,integer,text),public.operator_retry_profile_image(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.operator_claim_profile_image(uuid,uuid),public.operator_complete_profile_image(uuid,uuid,text,bigint,text,integer,integer,smallint,integer,text),public.operator_retry_profile_image(uuid,uuid,text) to service_role;
revoke all on function public.operator_count_due_profile_avatar_cleanup(),public.operator_claim_profile_avatar_cleanup(),public.operator_complete_profile_avatar_cleanup(uuid,uuid),public.operator_retry_profile_avatar_cleanup(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.operator_count_due_profile_avatar_cleanup(),public.operator_claim_profile_avatar_cleanup(),public.operator_complete_profile_avatar_cleanup(uuid,uuid),public.operator_retry_profile_avatar_cleanup(uuid,uuid,text) to service_role;

create policy reserved_profile_image_insert on storage.objects for insert to authenticated
with check(bucket_id='profile-images' and owner_id=(select auth.uid())::text and (select private.can_upload_reserved_profile_image(bucket_id,name)));

create index projects_owner_dashboard_idx on public.projects(owner_id,updated_at desc,id desc) where deleted_at is null and status in ('draft','active');
create index workspaces_active_owner_updated_idx on public.workspaces(owner_id,updated_at desc,id desc) where status='active';
create index contributions_author_active_updated_idx on public.contributions(author_id,updated_at desc,id desc) where status in ('draft','submitted','changes_requested');
create index contributions_submitted_project_idx on public.contributions(project_id,submitted_at desc,id desc) where status='submitted';
create index revision_attributions_accepted_profile_idx on public.revision_attributions(user_id,created_at desc,revision_id desc) where kind='accepted_contributor';

-- Only trusted service commands may transition a ready image to deleted during cleanup.
create or replace function private.protect_asset_immutability() returns trigger language plpgsql set search_path='' as $$
begin
  if old.owner_id<>new.owner_id or old.kind<>new.kind or old.bucket<>new.bucket or old.object_path<>new.object_path
    or (old.status='ready' and not (
      (old.kind='image' and new.status='deleted') or
      (new.status='ready' and
        (to_jsonb(new)-array['credits_confirmed_at','credits_confirmation_request_id','credits_confirmation_sha256'])
        is not distinct from
        (to_jsonb(old)-array['credits_confirmed_at','credits_confirmation_request_id','credits_confirmation_sha256']))
    ))
    or (old.credits_confirmed_at is not null and (
      new.credits_confirmed_at is distinct from old.credits_confirmed_at or
      new.credits_confirmation_request_id is distinct from old.credits_confirmation_request_id or
      new.credits_confirmation_sha256 is distinct from old.credits_confirmation_sha256
    )) then
    raise exception 'immutable_asset';
  end if;
  return new;
end $$;

comment on function public.get_viewer_dashboard() is 'Bounded private dashboard envelope for the active authenticated caller.';
comment on function public.touch_viewer_activity() is 'Throttles operational last_active_at writes to once per fifteen minutes.';
comment on table public.profile_avatar_versions is 'Trusted immutable public avatar derivatives; application roles use safe profile projections only.';
