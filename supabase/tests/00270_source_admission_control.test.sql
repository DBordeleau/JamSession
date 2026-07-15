begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(24);

select has_table('private','source_admission_control','trusted source-admission authority exists');
select has_function('public','get_source_admission_capability',array[]::text[],'read-only capability RPC exists');
select has_function('public','operator_set_source_admission_enabled',array['boolean'],'operator switch exists');
select ok(not has_table_privilege('anon','private.source_admission_control','select'),'anonymous users cannot read the authority table');
select ok(not has_table_privilege('authenticated','private.source_admission_control','update'),'authenticated users cannot mutate the authority table');
select ok(has_function_privilege('anon','public.get_source_admission_capability()','execute'),'anonymous clients may preflight the public capability');
select ok(has_function_privilege('authenticated','public.get_source_admission_capability()','execute'),'authenticated clients may preflight the public capability');
select ok(not has_function_privilege('authenticated','public.operator_set_source_admission_enabled(boolean)','execute'),'authenticated clients cannot operate the switch');

set local role anon;
select is((select source_audio_admission_enabled from public.get_source_admission_capability()),true,'MIDI-07 ships source admission enabled');
reset role;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('00000000-0000-0000-0000-000000000000','d7000000-0000-4000-8000-000000000001','authenticated','authenticated','admission-owner@example.test','','{}','{}',now(),now());
update public.profiles set username='AdmissionOwner',username_normalized='admissionowner',display_name='Admission Owner',credit_name='Admission Owner',profile_completed_at=now() where id='d7000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claim.sub='d7000000-0000-4000-8000-000000000001';
select lives_ok($$select public.reserve_source_asset('d7100000-0000-4000-8000-000000000001',1024,'finish.wav','audio/wav',1000,null)$$,'enabled authority admits a source reservation');
select lives_ok($$select public.reserve_source_asset('d7100000-0000-4000-8000-000000000002',2048,'cancel.wav','audio/wav',1000,null)$$,'second grace reservation is admitted before lock');
reset role;

create temp table grace_assets as
select id,original_filename from public.assets
where owner_id='d7000000-0000-4000-8000-000000000001';
grant select on grace_assets to authenticated,service_role;

insert into storage.objects(id,bucket_id,name,owner_id,metadata)
select gen_random_uuid(),a.bucket,a.object_path,a.owner_id,jsonb_build_object('size',1024)
from public.assets a join public.asset_uploads u on u.asset_id=a.id
where u.request_id='d7100000-0000-4000-8000-000000000001';

set local role service_role;
select is(public.operator_set_source_admission_enabled(false),false,'service operator disables new source admission');
reset role;

set local role anon;
select is((select source_audio_admission_enabled from public.get_source_admission_capability()),false,'public preflight reflects disabled authority');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='d7000000-0000-4000-8000-000000000001';
select throws_ok(
  $$select public.reserve_source_asset('d7100000-0000-4000-8000-000000000003',4096,'blocked.wav','audio/wav',1000,null)$$,
  'PT403','audio_uploads_unavailable','old-client direct RPC cannot bypass the disabled authority'
);
select lives_ok($$select public.reserve_source_asset('d7100000-0000-4000-8000-000000000001',1024,'finish.wav','audio/wav',1000,null)$$,'idempotent replay retains an existing grace reservation');
reset role;

select is((select count(*) from public.assets where owner_id='d7000000-0000-4000-8000-000000000001'),2::bigint,'denied reservation creates no asset row');
select is((select reserved_source_bytes from public.user_storage_usage where user_id='d7000000-0000-4000-8000-000000000001'),3072::bigint,'denied reservation does not mutate user quota');
select is((select reserved_source_bytes from public.global_storage_usage),3072::bigint,'denied reservation does not mutate global quota');

set local role authenticated;
set local request.jwt.claim.sub='d7000000-0000-4000-8000-000000000001';
select lives_ok($$select public.complete_source_upload((select id from grace_assets where original_filename='finish.wav'))$$,'valid in-flight upload completes while admission is disabled');
select lives_ok($$select public.cancel_source_upload((select id from grace_assets where original_filename='cancel.wav'))$$,'valid in-flight upload cancels while admission is disabled');
reset role;

set local role service_role;
select lives_ok($$select public.operator_promote_source_asset((select id from grace_assets where original_filename='finish.wav'),'audio/wav',1024::bigint,repeat('a',64),1000,48000,2::smallint,'midi-07-test')$$,'verification promotes an already completed upload while admission is disabled');
select is(public.operator_set_source_admission_enabled(true),true,'service operator can roll admission back on');
reset role;

select is((select status::text from public.assets where original_filename='finish.wav'),'ready','grace upload reaches ready state');
select is((select source_audio_admission_enabled from public.get_source_admission_capability()),true,'rollback is immediately visible to preflight readers');

select * from finish();
rollback;
