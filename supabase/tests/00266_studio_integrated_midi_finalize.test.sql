begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','c5000000-0000-4000-8000-000000000001','authenticated','authenticated','studio-midi-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','c5000000-0000-4000-8000-000000000002','authenticated','authenticated','studio-midi-other@example.test','','{}','{}',now(),now());
update public.profiles set username='StudioMidiOwner',username_normalized='studiomidiowner',display_name='Studio MIDI Owner',credit_name='Studio MIDI Owner',profile_completed_at=now() where id='c5000000-0000-4000-8000-000000000001';
update public.profiles set username='StudioMidiOther',username_normalized='studiomidiother',display_name='Studio MIDI Other',credit_name='Studio MIDI Other',profile_completed_at=now() where id='c5000000-0000-4000-8000-000000000002';

select has_function('public','finalize_studio_midi_draft',array['uuid','uuid','integer','text','uuid','integer','text','uuid','uuid','integer'],'integrated finalize RPC exists');
select function_privs_are('public','finalize_studio_midi_draft',array['uuid','uuid','integer','text','uuid','integer','text','uuid','uuid','integer'],'anon',array[]::text[],'anonymous cannot finalize into Studio');

set local role authenticated;
set local request.jwt.claim.sub='c5000000-0000-4000-8000-000000000001';
select lives_ok($$select public.create_midi_project_workspace(
  'c5100000-0000-4000-8000-000000000001','Integrated MIDI','',96::numeric,null::text,3::smallint,4::smallint,
  'all-rights-reserved','{}'::uuid[],null::uuid,'{}'::uuid[]
)$$,'owner creates the empty project workspace');
select lives_ok($$select public.create_midi_stem_draft('c5200000-0000-4000-8000-000000000001','Project keys','blank')$$,'owner creates a blank integrated draft');
select lives_ok($$select public.save_midi_stem_draft(
  (select id from public.midi_stem_drafts where owner_id='c5000000-0000-4000-8000-000000000001'),
  'c5200000-0000-4000-8000-000000000002',1,
  '{"name":"Project keys","defaultPresetId":"warm-poly","defaultPresetVersion":1,"ppq":480,"durationTicks":1920,"notes":[{"noteId":"c5200000-0000-4000-8000-000000000003","pitch":60,"velocity":100,"startTick":0,"durationTicks":480}]}'::jsonb
)$$,'draft autosave acknowledges the exact notes');
select lives_ok($$select public.finalize_studio_midi_draft(
  (select id from public.midi_stem_drafts where owner_id='c5000000-0000-4000-8000-000000000001'),
  'c5300000-0000-4000-8000-000000000001',2,
  (select content_sha256 from public.midi_stem_drafts where owner_id='c5000000-0000-4000-8000-000000000001'),
  (select id from public.workspaces where owner_id='c5000000-0000-4000-8000-000000000001'),1,'add',
  'c5300000-0000-4000-8000-000000000002','c5300000-0000-4000-8000-000000000003',480
)$$,'freeze and add commits as one operation');
select is((select count(*) from public.midi_stem_versions where owner_id='c5000000-0000-4000-8000-000000000001'),1::bigint,'add creates one immutable version');
select is((select count(*) from public.workspace_clips wc join public.workspaces w on w.id=wc.workspace_id where w.owner_id='c5000000-0000-4000-8000-000000000001'),1::bigint,'add projects one exact clip');
select lives_ok($$select public.finalize_studio_midi_draft(
  (select id from public.midi_stem_drafts where owner_id='c5000000-0000-4000-8000-000000000001'),
  'c5300000-0000-4000-8000-000000000001',2,
  (select content_sha256 from public.midi_stem_drafts where owner_id='c5000000-0000-4000-8000-000000000001'),
  (select id from public.workspaces where owner_id='c5000000-0000-4000-8000-000000000001'),1,'add',
  'c5300000-0000-4000-8000-000000000002','c5300000-0000-4000-8000-000000000003',480
)$$,'exact retry is idempotent');
select is((select count(*) from public.midi_stem_versions where owner_id='c5000000-0000-4000-8000-000000000001'),1::bigint,'retry creates no duplicate version');
select throws_ok($$select public.finalize_studio_midi_draft(
  (select id from public.midi_stem_drafts where owner_id='c5000000-0000-4000-8000-000000000001'),
  'c5300000-0000-4000-8000-000000000001',2,
  (select content_sha256 from public.midi_stem_drafts where owner_id='c5000000-0000-4000-8000-000000000001'),
  (select id from public.workspaces where owner_id='c5000000-0000-4000-8000-000000000001'),1,'add',
  'c5300000-0000-4000-8000-000000000009','c5300000-0000-4000-8000-000000000003',480
)$$,'PT409','studio_midi_apply_request_conflict','changed retry intent is rejected');

select lives_ok($$select public.save_midi_workspace(
  (select id from public.workspaces where owner_id='c5000000-0000-4000-8000-000000000001'),gen_random_uuid(),2,
  jsonb_set(
    (select manifest from public.workspaces where owner_id='c5000000-0000-4000-8000-000000000001'),
    '{tracks,0,clips}',
    (select manifest->'tracks'->0->'clips' from public.workspaces where owner_id='c5000000-0000-4000-8000-000000000001') ||
    jsonb_build_array(jsonb_build_object(
      'clipId','c5300000-0000-4000-8000-000000000004',
      'midiStemVersionId',(select id from public.midi_stem_versions where owner_id='c5000000-0000-4000-8000-000000000001'),
      'startTick',2880,'durationTicks',960,'sourceStartTick',0,'loop',false
    ))
  )
)$$,'workspace keeps a second clip on the same exact source version');
select lives_ok($$select public.create_midi_stem_draft(
  'c5400000-0000-4000-8000-000000000001','Project keys variation','derive',
  (select id from public.midi_stem_versions where owner_id='c5000000-0000-4000-8000-000000000001')
)$$,'owner derives the selected exact version');
select lives_ok($$select public.finalize_studio_midi_draft(
  (select id from public.midi_stem_drafts where owner_id='c5000000-0000-4000-8000-000000000001' and parent_stem_version_id is not null),
  'c5400000-0000-4000-8000-000000000002',1,
  (select content_sha256 from public.midi_stem_drafts where owner_id='c5000000-0000-4000-8000-000000000001' and parent_stem_version_id is not null),
  (select id from public.workspaces where owner_id='c5000000-0000-4000-8000-000000000001'),3,'replace',
  'c5300000-0000-4000-8000-000000000002','c5300000-0000-4000-8000-000000000003',null
)$$,'derived version replaces exactly the selected clip');
select isnt(
  (select midi_stem_version_id from public.workspace_clips where clip_id='c5300000-0000-4000-8000-000000000003'),
  (select midi_stem_version_id from public.workspace_clips where clip_id='c5300000-0000-4000-8000-000000000004'),
  'replacement leaves the other clip on the old immutable version'
);
select is((select count(*) from public.workspace_clips wc join public.workspaces w on w.id=wc.workspace_id where w.owner_id='c5000000-0000-4000-8000-000000000001'),2::bigint,'replacement preserves every other clip');

select throws_ok($$select public.finalize_studio_midi_draft(
  (select id from public.midi_stem_drafts where owner_id='c5000000-0000-4000-8000-000000000001' and parent_stem_version_id is not null),gen_random_uuid(),1,
  (select content_sha256 from public.midi_stem_drafts where owner_id='c5000000-0000-4000-8000-000000000001' and parent_stem_version_id is not null),
  (select id from public.workspaces where owner_id='c5000000-0000-4000-8000-000000000001'),4,'add',gen_random_uuid(),gen_random_uuid(),86399999
)$$,'22023','workspace_track_limit','post-version projection failure rolls the complete operation back');
select is((select count(*) from public.midi_stem_versions where owner_id='c5000000-0000-4000-8000-000000000001'),2::bigint,'failed projection leaves no orphan immutable version');

select throws_ok($$select public.finalize_studio_midi_draft(
  (select id from public.midi_stem_drafts where owner_id='c5000000-0000-4000-8000-000000000001' and parent_stem_version_id is not null),gen_random_uuid(),1,
  (select content_sha256 from public.midi_stem_drafts where owner_id='c5000000-0000-4000-8000-000000000001' and parent_stem_version_id is not null),
  (select id from public.workspaces where owner_id='c5000000-0000-4000-8000-000000000001'),3,'add',gen_random_uuid(),gen_random_uuid(),0
)$$,'PT409','workspace_save_conflict','stale workspace is rejected before a version can survive');
select is((select count(*) from public.midi_stem_versions where owner_id='c5000000-0000-4000-8000-000000000001'),2::bigint,'stale apply leaves no orphan version');

create temporary table studio_midi_owner_authority(draft_id uuid,content_sha256 text,workspace_id uuid);
insert into studio_midi_owner_authority
select d.id,d.content_sha256,w.id from public.midi_stem_drafts d cross join public.workspaces w
where d.owner_id='c5000000-0000-4000-8000-000000000001' and d.parent_stem_version_id is not null
  and w.owner_id='c5000000-0000-4000-8000-000000000001';
set local request.jwt.claim.sub='c5000000-0000-4000-8000-000000000002';
select throws_ok($$select public.finalize_studio_midi_draft(
  (select draft_id from studio_midi_owner_authority),gen_random_uuid(),1,
  (select content_sha256 from studio_midi_owner_authority),(select workspace_id from studio_midi_owner_authority),
  4,'add',gen_random_uuid(),gen_random_uuid(),0
)$$,'PT404','workspace_not_found','unrelated actor cannot apply an owner draft or workspace');

select * from finish();
rollback;
