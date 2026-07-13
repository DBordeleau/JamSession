create type public.project_visibility as enum ('private', 'unlisted', 'public');
create type public.project_status as enum ('draft', 'active', 'archived', 'deleted');
create type public.member_role as enum ('owner', 'editor', 'viewer');

create table public.licenses (
  code text primary key,
  name text not null unique,
  url text not null,
  summary text not null,
  allows_derivatives boolean not null,
  requires_attribution boolean not null,
  share_alike boolean not null,
  is_active boolean not null default true,
  sort_order smallint not null unique,
  created_at timestamptz not null default now(),
  constraint licenses_code_check check (code ~ '^[a-z0-9]+(?:[.-][a-z0-9]+)*$' and char_length(code) <= 40),
  constraint licenses_name_check check (name = btrim(name) and char_length(name) between 1 and 100),
  constraint licenses_url_check check (url ~ '^https://[^[:space:]]+$' and char_length(url) <= 500),
  constraint licenses_summary_check check (summary = btrim(summary) and char_length(summary) between 1 and 300),
  constraint licenses_order_check check (sort_order >= 0),
  constraint licenses_flags_check check (not share_alike or allows_derivatives)
);

create table public.genres (
  id uuid primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 50),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 80),
  is_active boolean not null default true,
  sort_order smallint not null unique check (sort_order >= 0),
  created_at timestamptz not null default now()
);
create table public.tags (
  id uuid primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 50),
  display_name text not null check (display_name = btrim(display_name) and char_length(display_name) between 1 and 80),
  is_active boolean not null default true,
  sort_order smallint not null unique check (sort_order >= 0),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index tags_created_by_idx on public.tags(created_by) where created_by is not null;
create table public.instruments (
  id uuid primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 50),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 80),
  parent_id uuid references public.instruments(id) on delete restrict,
  is_active boolean not null default true,
  sort_order smallint not null unique check (sort_order >= 0),
  created_at timestamptz not null default now(),
  constraint instruments_not_self_parent check (parent_id is null or parent_id <> id)
);
create index instruments_parent_id_idx on public.instruments(parent_id) where parent_id is not null;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  create_request_id uuid not null,
  title text not null,
  description text,
  visibility public.project_visibility not null default 'private',
  status public.project_status not null default 'draft',
  open_to_contributions boolean not null default false,
  bpm numeric(6,3),
  musical_key text,
  time_signature_numerator smallint not null default 4,
  time_signature_denominator smallint not null default 4,
  license_code text not null references public.licenses(code) on delete restrict,
  lock_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  deleted_at timestamptz,
  constraint projects_owner_request_uq unique(owner_id, create_request_id),
  constraint projects_title_check check (title = btrim(title) and char_length(title) between 1 and 120),
  constraint projects_description_check check (description is null or (description = btrim(description) and char_length(description) between 1 and 5000)),
  constraint projects_bpm_check check (bpm is null or (bpm between 20 and 400 and scale(bpm) <= 3)),
  constraint projects_key_check check (musical_key is null or musical_key = any(array['c-major','c-sharp-major','d-major','e-flat-major','e-major','f-major','f-sharp-major','g-major','a-flat-major','a-major','b-flat-major','b-major','c-minor','c-sharp-minor','d-minor','e-flat-minor','e-minor','f-minor','f-sharp-minor','g-minor','g-sharp-minor','a-minor','b-flat-minor','b-minor'])),
  constraint projects_time_signature_check check (time_signature_numerator between 1 and 32 and time_signature_denominator = any(array[1,2,4,8,16,32])),
  constraint projects_lock_version_check check (lock_version > 0),
  constraint projects_pr06_lifecycle_check check (visibility = 'private' and status = 'draft' and not open_to_contributions and published_at is null and deleted_at is null)
);
create index projects_owner_id_idx on public.projects(owner_id);
create index projects_license_code_idx on public.projects(license_code);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  role public.member_role not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(project_id, user_id)
);
create unique index project_members_one_owner_idx on public.project_members(project_id) where role = 'owner';
create index project_members_user_id_idx on public.project_members(user_id);
create index project_members_created_by_idx on public.project_members(created_by);

create table public.project_genres (
  project_id uuid not null references public.projects(id) on delete cascade,
  genre_id uuid not null references public.genres(id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key(project_id, genre_id)
);
create unique index project_genres_one_primary_idx on public.project_genres(project_id) where is_primary;
create index project_genres_genre_id_idx on public.project_genres(genre_id);
create table public.project_tags (
  project_id uuid not null references public.projects(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(project_id, tag_id)
);
create index project_tags_tag_id_idx on public.project_tags(tag_id);

insert into public.licenses(code,name,url,summary,allows_derivatives,requires_attribution,share_alike,sort_order) values
('all-rights-reserved','All rights reserved','https://jamsession.example/licenses/all-rights-reserved','No contribution or reuse permission is granted.',false,false,false,0),
('cc-by-4.0','CC BY 4.0','https://creativecommons.org/licenses/by/4.0/','Derivatives are allowed with attribution.',true,true,false,1),
('cc-by-sa-4.0','CC BY-SA 4.0','https://creativecommons.org/licenses/by-sa/4.0/','Derivatives are allowed with attribution and share-alike.',true,true,true,2),
('cc0-1.0','CC0 1.0','https://creativecommons.org/publicdomain/zero/1.0/','Public-domain dedication where legally effective.',true,false,false,3);

insert into public.genres(id,slug,name,sort_order) values
('10000000-0000-4000-8000-000000000001','electronic','Electronic',1),('10000000-0000-4000-8000-000000000002','hip-hop','Hip-hop',2),('10000000-0000-4000-8000-000000000003','rock','Rock',3),('10000000-0000-4000-8000-000000000004','pop','Pop',4),('10000000-0000-4000-8000-000000000005','r-and-b','R&B',5),('10000000-0000-4000-8000-000000000006','jazz','Jazz',6),('10000000-0000-4000-8000-000000000007','classical','Classical',7),('10000000-0000-4000-8000-000000000008','folk','Folk',8),('10000000-0000-4000-8000-000000000009','country','Country',9),('10000000-0000-4000-8000-00000000000a','metal','Metal',10),('10000000-0000-4000-8000-00000000000b','ambient','Ambient',11),('10000000-0000-4000-8000-00000000000c','experimental','Experimental',12);
insert into public.tags(id,slug,display_name,sort_order) values
('20000000-0000-4000-8000-000000000001','collaboration-wanted','Collaboration wanted',1),('20000000-0000-4000-8000-000000000002','remix-friendly','Remix friendly',2),('20000000-0000-4000-8000-000000000003','work-in-progress','Work in progress',3),('20000000-0000-4000-8000-000000000004','instrumental','Instrumental',4),('20000000-0000-4000-8000-000000000005','vocals-needed','Vocals needed',5),('20000000-0000-4000-8000-000000000006','drums-needed','Drums needed',6),('20000000-0000-4000-8000-000000000007','bass-needed','Bass needed',7),('20000000-0000-4000-8000-000000000008','guitar-needed','Guitar needed',8),('20000000-0000-4000-8000-000000000009','keys-needed','Keys needed',9),('20000000-0000-4000-8000-00000000000a','mixing-needed','Mixing needed',10),('20000000-0000-4000-8000-00000000000b','mastering-needed','Mastering needed',11),('20000000-0000-4000-8000-00000000000c','upbeat','Upbeat',12),('20000000-0000-4000-8000-00000000000d','mellow','Mellow',13),('20000000-0000-4000-8000-00000000000e','dark','Dark',14),('20000000-0000-4000-8000-00000000000f','cinematic','Cinematic',15),('20000000-0000-4000-8000-000000000010','live-recording','Live recording',16);
insert into public.instruments(id,slug,name,sort_order) values
('30000000-0000-4000-8000-000000000001','vocals','Vocals',1),('30000000-0000-4000-8000-000000000002','backing-vocals','Backing vocals',2),('30000000-0000-4000-8000-000000000003','drums','Drums',3),('30000000-0000-4000-8000-000000000004','percussion','Percussion',4),('30000000-0000-4000-8000-000000000005','bass','Bass',5),('30000000-0000-4000-8000-000000000006','electric-guitar','Electric guitar',6),('30000000-0000-4000-8000-000000000007','acoustic-guitar','Acoustic guitar',7),('30000000-0000-4000-8000-000000000008','piano','Piano',8),('30000000-0000-4000-8000-000000000009','keys','Keys',9),('30000000-0000-4000-8000-00000000000a','synthesizer','Synthesizer',10),('30000000-0000-4000-8000-00000000000b','strings','Strings',11),('30000000-0000-4000-8000-00000000000c','brass','Brass',12),('30000000-0000-4000-8000-00000000000d','woodwinds','Woodwinds',13),('30000000-0000-4000-8000-00000000000e','field-recording','Field recording',14),('30000000-0000-4000-8000-00000000000f','sound-effects','Sound effects',15),('30000000-0000-4000-8000-000000000010','other','Other',16);

create function private.assert_project_owner_invariant() returns trigger language plpgsql security definer set search_path='' as $$
declare v_project uuid := coalesce(new.project_id, old.project_id, new.id, old.id); begin
  if not exists(select 1 from public.projects p join public.project_members m on m.project_id=p.id and m.role='owner' and m.user_id=p.owner_id and m.created_by=p.owner_id where p.id=v_project)
     or (select count(*) from public.project_members where project_id=v_project and role='owner') <> 1 then
    raise exception using errcode='23514', message='project_owner_invariant';
  end if; return null;
end $$;
revoke all on function private.assert_project_owner_invariant() from public,anon,authenticated;
create constraint trigger projects_owner_invariant after insert or update on public.projects deferrable initially deferred for each row execute function private.assert_project_owner_invariant();
create constraint trigger members_owner_invariant after insert or update or delete on public.project_members deferrable initially deferred for each row execute function private.assert_project_owner_invariant();

create function private.assert_project_taxonomy_limits() returns trigger language plpgsql security definer set search_path='' as $$
declare v_project uuid := coalesce(new.project_id,old.project_id); begin
 if (select count(*) from public.project_genres where project_id=v_project)>3 or (select count(*) from public.project_tags where project_id=v_project)>10 then raise exception using errcode='23514',message='project_taxonomy_limit'; end if; return null;
end $$;
revoke all on function private.assert_project_taxonomy_limits() from public,anon,authenticated;
create constraint trigger project_genres_limit after insert or update on public.project_genres deferrable initially deferred for each row execute function private.assert_project_taxonomy_limits();
create constraint trigger project_tags_limit after insert or update on public.project_tags deferrable initially deferred for each row execute function private.assert_project_taxonomy_limits();

create function private.is_active_project_actor() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.status='active' and p.profile_completed_at is not null)
$$;
revoke all on function private.is_active_project_actor() from public,anon;
grant execute on function private.is_active_project_actor() to authenticated;

alter table public.licenses enable row level security; alter table public.genres enable row level security; alter table public.tags enable row level security; alter table public.instruments enable row level security;
alter table public.projects enable row level security; alter table public.project_members enable row level security; alter table public.project_genres enable row level security; alter table public.project_tags enable row level security;
revoke all on public.licenses,public.genres,public.tags,public.instruments,public.projects,public.project_members,public.project_genres,public.project_tags from public,anon,authenticated;
grant select on public.licenses,public.genres,public.tags,public.instruments to anon,authenticated;
grant select on public.projects,public.project_members,public.project_genres,public.project_tags to authenticated;
create policy active_licenses_read on public.licenses for select to anon,authenticated using(is_active);
create policy active_genres_read on public.genres for select to anon,authenticated using(is_active);
create policy active_tags_read on public.tags for select to anon,authenticated using(is_active);
create policy active_instruments_read on public.instruments for select to anon,authenticated using(is_active);
create policy owner_projects_read on public.projects for select to authenticated using(owner_id=(select auth.uid()) and (select private.is_active_project_actor()));
create policy owner_members_read on public.project_members for select to authenticated using(user_id=(select auth.uid()) and role='owner' and (select private.is_active_project_actor()));
create policy owner_genres_read on public.project_genres for select to authenticated using(exists(select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid())) and (select private.is_active_project_actor()));
create policy owner_tags_read on public.project_tags for select to authenticated using(exists(select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid())) and (select private.is_active_project_actor()));

create function public.create_project(p_request_id uuid,p_title text,p_description text,p_bpm numeric,p_musical_key text,p_time_signature_numerator smallint,p_time_signature_denominator smallint,p_license_code text,p_genre_ids uuid[],p_primary_genre_id uuid,p_tag_ids uuid[])
returns table(id uuid,title text,lock_version integer) language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_id uuid; v_description text:=nullif(btrim(p_description),'');
begin
 if v_actor is null then raise sqlstate 'PT401' using message='project_unauthenticated'; end if;
 if not exists(select 1 from public.profiles where profiles.id=v_actor and status='active' and profile_completed_at is not null) then raise sqlstate 'PT403' using message='project_actor_ineligible'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||p_request_id::text,0));
 select p.id into v_id from public.projects p where p.owner_id=v_actor and p.create_request_id=p_request_id;
 if found then
  if exists(select 1 from public.projects p where p.id=v_id and (p.title<>btrim(p_title) or p.description is distinct from v_description or p.bpm is distinct from p_bpm or p.musical_key is distinct from p_musical_key or p.time_signature_numerator<>p_time_signature_numerator or p.time_signature_denominator<>p_time_signature_denominator or p.license_code<>p_license_code))
    or (select coalesce(array_agg(genre_id order by genre_id),'{}'::uuid[]) from public.project_genres where project_id=v_id) <> (select coalesce(array_agg(x order by x),'{}'::uuid[]) from unnest(coalesce(p_genre_ids,'{}')) x)
    or (select coalesce(array_agg(tag_id order by tag_id),'{}'::uuid[]) from public.project_tags where project_id=v_id) <> (select coalesce(array_agg(x order by x),'{}'::uuid[]) from unnest(coalesce(p_tag_ids,'{}')) x)
    or (select genre_id from public.project_genres where project_id=v_id and is_primary) is distinct from p_primary_genre_id then raise sqlstate 'PT409' using message='project_request_conflict'; end if;
  return query select p.id,p.title,p.lock_version from public.projects p where p.id=v_id; return;
 end if;
 if p_request_id is null or p_title is null or p_title<>btrim(p_title) or char_length(p_title) not between 1 and 120 or (p_description is not null and (p_description<>btrim(p_description) or char_length(p_description)>5000)) or (p_bpm is not null and (p_bpm not between 20 and 400 or scale(p_bpm)>3)) or p_time_signature_numerator not between 1 and 32 or p_time_signature_denominator<>all(array[1,2,4,8,16,32]) then raise sqlstate 'PT400' using message='project_metadata_invalid'; end if;
 if coalesce(cardinality(p_genre_ids),0)>3 or coalesce(cardinality(p_tag_ids),0)>10 or (select count(*)<>count(distinct x) from unnest(coalesce(p_genre_ids,'{}')) x) or (select count(*)<>count(distinct x) from unnest(coalesce(p_tag_ids,'{}')) x) or (p_primary_genre_id is not null and not p_primary_genre_id=any(coalesce(p_genre_ids,'{}'))) then raise sqlstate 'PT400' using message='project_taxonomy_invalid'; end if;
 if not exists(select 1 from public.licenses where code=p_license_code and is_active) or exists(select 1 from unnest(coalesce(p_genre_ids,'{}')) x left join public.genres g on g.id=x and g.is_active where g.id is null) or exists(select 1 from unnest(coalesce(p_tag_ids,'{}')) x left join public.tags t on t.id=x and t.is_active where t.id is null) then raise sqlstate 'PT400' using message='project_reference_invalid'; end if;
 insert into public.projects(owner_id,create_request_id,title,description,bpm,musical_key,time_signature_numerator,time_signature_denominator,license_code) values(v_actor,p_request_id,p_title,v_description,p_bpm,p_musical_key,p_time_signature_numerator,p_time_signature_denominator,p_license_code) returning projects.id into v_id;
 insert into public.project_members values(v_id,v_actor,'owner',v_actor,default);
 insert into public.project_genres(project_id,genre_id,is_primary) select v_id,x,x=p_primary_genre_id from unnest(coalesce(p_genre_ids,'{}')) x;
 insert into public.project_tags(project_id,tag_id) select v_id,x from unnest(coalesce(p_tag_ids,'{}')) x;
 return query select p.id,p.title,p.lock_version from public.projects p where p.id=v_id;
end $$;
revoke all on function public.create_project(uuid,text,text,numeric,text,smallint,smallint,text,uuid[],uuid,uuid[]) from public,anon;
grant execute on function public.create_project(uuid,text,text,numeric,text,smallint,smallint,text,uuid[],uuid,uuid[]) to authenticated;

create function public.update_project_metadata(p_project_id uuid,p_expected_lock_version integer,p_title text,p_description text,p_bpm numeric,p_musical_key text,p_time_signature_numerator smallint,p_time_signature_denominator smallint,p_license_code text,p_genre_ids uuid[],p_primary_genre_id uuid,p_tag_ids uuid[])
returns table(id uuid,title text,lock_version integer) language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_project public.projects%rowtype; v_description text:=nullif(btrim(p_description),''); v_changed boolean;
begin
 if v_actor is null then raise sqlstate 'PT401' using message='project_unauthenticated'; end if;
 if not exists(select 1 from public.profiles where profiles.id=v_actor and status='active' and profile_completed_at is not null) then raise sqlstate 'PT403' using message='project_actor_ineligible'; end if;
 select * into v_project from public.projects p where p.id=p_project_id and p.owner_id=v_actor and p.status='draft' for update;
 if not found then raise sqlstate 'PT404' using message='project_not_found'; end if;
 if v_project.lock_version<>p_expected_lock_version then raise sqlstate 'PT409' using message='project_edit_conflict'; end if;
 if p_title is null or p_title<>btrim(p_title) or char_length(p_title) not between 1 and 120 or (p_description is not null and (p_description<>btrim(p_description) or char_length(p_description)>5000)) or (p_bpm is not null and (p_bpm not between 20 and 400 or scale(p_bpm)>3)) or p_time_signature_numerator not between 1 and 32 or p_time_signature_denominator<>all(array[1,2,4,8,16,32]) then raise sqlstate 'PT400' using message='project_metadata_invalid'; end if;
 if coalesce(cardinality(p_genre_ids),0)>3 or coalesce(cardinality(p_tag_ids),0)>10 or (select count(*)<>count(distinct x) from unnest(coalesce(p_genre_ids,'{}')) x) or (select count(*)<>count(distinct x) from unnest(coalesce(p_tag_ids,'{}')) x) or (p_primary_genre_id is not null and not p_primary_genre_id=any(coalesce(p_genre_ids,'{}'))) then raise sqlstate 'PT400' using message='project_taxonomy_invalid'; end if;
 if not exists(select 1 from public.licenses where code=p_license_code and is_active) or exists(select 1 from unnest(coalesce(p_genre_ids,'{}')) x left join public.genres g on g.id=x and g.is_active where g.id is null) or exists(select 1 from unnest(coalesce(p_tag_ids,'{}')) x left join public.tags t on t.id=x and t.is_active where t.id is null) then raise sqlstate 'PT400' using message='project_reference_invalid'; end if;
 v_changed := v_project.title<>p_title or v_project.description is distinct from v_description or v_project.bpm is distinct from p_bpm or v_project.musical_key is distinct from p_musical_key or v_project.time_signature_numerator<>p_time_signature_numerator or v_project.time_signature_denominator<>p_time_signature_denominator or v_project.license_code<>p_license_code or (select coalesce(array_agg(genre_id order by genre_id),'{}'::uuid[]) from public.project_genres where project_id=p_project_id)<>(select coalesce(array_agg(x order by x),'{}'::uuid[]) from unnest(coalesce(p_genre_ids,'{}')) x) or (select coalesce(array_agg(tag_id order by tag_id),'{}'::uuid[]) from public.project_tags where project_id=p_project_id)<>(select coalesce(array_agg(x order by x),'{}'::uuid[]) from unnest(coalesce(p_tag_ids,'{}')) x) or (select genre_id from public.project_genres where project_id=p_project_id and is_primary) is distinct from p_primary_genre_id;
 if v_changed then delete from public.project_genres where project_id=p_project_id; delete from public.project_tags where project_id=p_project_id; insert into public.project_genres(project_id,genre_id,is_primary) select p_project_id,x,x=p_primary_genre_id from unnest(coalesce(p_genre_ids,'{}')) x; insert into public.project_tags(project_id,tag_id) select p_project_id,x from unnest(coalesce(p_tag_ids,'{}')) x; update public.projects p set title=p_title,description=v_description,bpm=p_bpm,musical_key=p_musical_key,time_signature_numerator=p_time_signature_numerator,time_signature_denominator=p_time_signature_denominator,license_code=p_license_code,lock_version=p.lock_version+1,updated_at=statement_timestamp() where p.id=p_project_id; end if;
 return query select p.id,p.title,p.lock_version from public.projects p where p.id=p_project_id;
end $$;
revoke all on function public.update_project_metadata(uuid,integer,text,text,numeric,text,smallint,smallint,text,uuid[],uuid,uuid[]) from public,anon;
grant execute on function public.update_project_metadata(uuid,integer,text,text,numeric,text,smallint,smallint,text,uuid[],uuid,uuid[]) to authenticated;

comment on table public.projects is 'Private project metadata foundation; revisions, assets, publishing, and forks are intentionally deferred.';
