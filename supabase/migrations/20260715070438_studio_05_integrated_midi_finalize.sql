-- STUDIO-05: freeze one acknowledged MIDI draft and apply it to one active
-- workspace as a single replay-safe user-visible operation.

create table private.studio_midi_apply_requests (
  actor_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null,
  draft_id uuid not null,
  expected_draft_lock_version integer not null,
  expected_content_sha256 text not null,
  workspace_id uuid not null,
  expected_workspace_lock_version integer not null,
  operation text not null check (operation in ('add', 'replace')),
  track_id uuid not null,
  clip_id uuid not null,
  start_tick integer,
  stem_version_id uuid not null references public.midi_stem_versions(id) on delete restrict,
  stem_version integer not null,
  creator_credit_name text not null,
  workspace_lock_version integer not null,
  workspace_manifest_sha256 text not null,
  workspace_manifest jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (actor_id, request_id)
);

revoke all on table private.studio_midi_apply_requests from public, anon, authenticated;

create function public.finalize_studio_midi_draft(
  p_draft_id uuid,
  p_request_id uuid,
  p_expected_draft_lock_version integer,
  p_expected_content_sha256 text,
  p_workspace_id uuid,
  p_expected_workspace_lock_version integer,
  p_operation text,
  p_track_id uuid,
  p_clip_id uuid,
  p_start_tick integer default null
) returns table(
  stem_version_id uuid,
  stem_id uuid,
  version integer,
  creator_credit_name text,
  version_created_at timestamptz,
  workspace_lock_version integer,
  workspace_manifest_sha256 text,
  workspace_updated_at timestamptz,
  workspace_manifest jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_actor uuid := (select auth.uid());
  v_replay private.studio_midi_apply_requests%rowtype;
  v_workspace public.workspaces%rowtype;
  v_draft public.midi_stem_drafts%rowtype;
  v_published record;
  v_version public.midi_stem_versions%rowtype;
  v_saved record;
  v_manifest jsonb;
  v_tracks jsonb;
  v_track jsonb;
  v_clips jsonb;
  v_clip jsonb;
  v_track_index integer := -1;
  v_clip_index integer := -1;
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'studio_midi_unauthenticated';
  end if;
  if p_draft_id is null or p_request_id is null
    or p_expected_draft_lock_version is null or p_expected_draft_lock_version <= 0
    or p_expected_content_sha256 is null
    or p_expected_content_sha256 !~ '^[0-9a-f]{64}$'
    or p_workspace_id is null or p_expected_workspace_lock_version is null
    or p_expected_workspace_lock_version <= 0
    or p_operation not in ('add', 'replace')
    or p_track_id is null or p_clip_id is null
    or (p_operation = 'add' and (p_start_tick is null or p_start_tick < 0))
    or (p_operation = 'replace' and p_start_tick is not null) then
    raise sqlstate '22023' using message = 'studio_midi_apply_invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'studio-midi-apply:' || v_actor::text || ':' || p_request_id::text,
      0
    )
  );

  select * into v_replay
  from private.studio_midi_apply_requests
  where actor_id = v_actor and request_id = p_request_id;
  if found then
    if v_replay.draft_id <> p_draft_id
      or v_replay.expected_draft_lock_version <> p_expected_draft_lock_version
      or v_replay.expected_content_sha256 <> p_expected_content_sha256
      or v_replay.workspace_id <> p_workspace_id
      or v_replay.expected_workspace_lock_version <> p_expected_workspace_lock_version
      or v_replay.operation <> p_operation
      or v_replay.track_id <> p_track_id
      or v_replay.clip_id <> p_clip_id
      or v_replay.start_tick is distinct from p_start_tick then
      raise sqlstate 'PT409' using message = 'studio_midi_apply_request_conflict';
    end if;
    return query select
      v_replay.stem_version_id,
      (select stem_id from public.midi_stem_versions where id = v_replay.stem_version_id),
      v_replay.stem_version,
      v_replay.creator_credit_name,
      (select created_at from public.midi_stem_versions where id = v_replay.stem_version_id),
      v_replay.workspace_lock_version,
      v_replay.workspace_manifest_sha256,
      (select updated_at from public.workspaces where id = v_replay.workspace_id),
      v_replay.workspace_manifest;
    return;
  end if;

  select * into v_workspace
  from public.workspaces
  where id = p_workspace_id and owner_id = v_actor and status = 'active';
  if not found or v_workspace.manifest_version <> 2 then
    raise sqlstate 'PT404' using message = 'workspace_not_found';
  end if;
  if v_workspace.lock_version <> p_expected_workspace_lock_version then
    raise sqlstate 'PT409' using message = 'workspace_save_conflict';
  end if;

  select * into v_draft
  from public.midi_stem_drafts
  where id = p_draft_id and owner_id = v_actor;
  if not found then
    raise sqlstate 'PT404' using message = 'midi_stem_draft_not_found';
  end if;

  select * into strict v_published
  from public.publish_midi_stem_version(
    p_draft_id,
    p_request_id,
    p_expected_draft_lock_version,
    p_expected_content_sha256
  );
  select * into strict v_version
  from public.midi_stem_versions
  where id = v_published.stem_version_id;

  v_manifest := v_workspace.manifest;
  v_tracks := v_manifest->'tracks';
  if p_operation = 'add' then
    if jsonb_array_length(v_tracks) >= 16 then
      raise sqlstate '22023' using message = 'workspace_track_limit_reached';
    end if;
    for v_index in 0..jsonb_array_length(v_tracks) - 1 loop
      if v_tracks->v_index->>'trackId' = p_track_id::text then
        raise sqlstate 'PT409' using message = 'studio_midi_track_exists';
      end if;
    end loop;
    v_track := jsonb_build_object(
      'kind', 'midi',
      'trackId', p_track_id,
      'name', v_draft.name,
      'instrumentId', null,
      'presetId', v_draft.default_preset_id,
      'presetVersion', v_draft.default_preset_version,
      'gainDb', 0,
      'pan', 0,
      'muted', false,
      'soloed', false,
      'sortOrder', jsonb_array_length(v_tracks),
      'clips', jsonb_build_array(jsonb_build_object(
        'clipId', p_clip_id,
        'midiStemVersionId', v_version.id,
        'startTick', p_start_tick,
        'durationTicks', v_draft.duration_ticks,
        'sourceStartTick', 0,
        'loop', false
      ))
    );
    v_manifest := jsonb_set(v_manifest, '{tracks}', v_tracks || jsonb_build_array(v_track));
    v_manifest := jsonb_set(
      v_manifest,
      '{durationTicks}',
      to_jsonb(greatest((v_manifest->>'durationTicks')::integer, p_start_tick + v_draft.duration_ticks))
    );
  else
    for v_index in 0..jsonb_array_length(v_tracks) - 1 loop
      if v_tracks->v_index->>'trackId' = p_track_id::text then
        v_track_index := v_index;
        v_track := v_tracks->v_index;
        exit;
      end if;
    end loop;
    if v_track_index < 0 or v_track->>'kind' <> 'midi' then
      raise sqlstate 'PT404' using message = 'studio_midi_target_not_found';
    end if;
    v_clips := v_track->'clips';
    for v_index in 0..jsonb_array_length(v_clips) - 1 loop
      if v_clips->v_index->>'clipId' = p_clip_id::text then
        v_clip_index := v_index;
        v_clip := v_clips->v_index;
        exit;
      end if;
    end loop;
    if v_clip_index < 0 then
      raise sqlstate 'PT404' using message = 'studio_midi_target_not_found';
    end if;
    v_clip := jsonb_set(v_clip, '{midiStemVersionId}', to_jsonb(v_version.id));
    v_clip := jsonb_set(v_clip, '{sourceStartTick}', '0'::jsonb);
    v_clip := jsonb_set(
      v_clip,
      '{durationTicks}',
      to_jsonb(least((v_clip->>'durationTicks')::integer, v_draft.duration_ticks))
    );
    v_clips := jsonb_set(v_clips, array[v_clip_index::text], v_clip);
    v_track := jsonb_set(v_track, '{clips}', v_clips);
    v_tracks := jsonb_set(v_tracks, array[v_track_index::text], v_track);
    v_manifest := jsonb_set(v_manifest, '{tracks}', v_tracks);
  end if;

  select * into strict v_saved
  from public.save_midi_workspace(
    p_workspace_id,
    p_request_id,
    p_expected_workspace_lock_version,
    v_manifest
  );

  select * into strict v_workspace
  from public.workspaces where id = p_workspace_id;

  insert into private.studio_midi_apply_requests(
    actor_id, request_id, draft_id, expected_draft_lock_version,
    expected_content_sha256, workspace_id, expected_workspace_lock_version,
    operation, track_id, clip_id, start_tick, stem_version_id, stem_version,
    creator_credit_name, workspace_lock_version, workspace_manifest_sha256,
    workspace_manifest
  ) values (
    v_actor, p_request_id, p_draft_id, p_expected_draft_lock_version,
    p_expected_content_sha256, p_workspace_id, p_expected_workspace_lock_version,
    p_operation, p_track_id, p_clip_id, p_start_tick, v_version.id,
    v_version.version, v_version.creator_credit_name, v_saved.lock_version,
    v_saved.manifest_sha256, v_workspace.manifest
  );

  return query select
    v_version.id, v_version.stem_id, v_version.version,
    v_version.creator_credit_name, v_version.created_at,
    v_saved.lock_version, v_saved.manifest_sha256, v_saved.updated_at,
    v_workspace.manifest;
end;
$$;

revoke all on function public.finalize_studio_midi_draft(
  uuid,uuid,integer,text,uuid,integer,text,uuid,uuid,integer
) from public, anon;
grant execute on function public.finalize_studio_midi_draft(
  uuid,uuid,integer,text,uuid,integer,text,uuid,uuid,integer
) to authenticated;
