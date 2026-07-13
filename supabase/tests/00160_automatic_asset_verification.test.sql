begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('00000000-0000-0000-0000-000000000000','b0000000-0000-4000-8000-000000000001','authenticated','authenticated','verification-owner@example.test','','{}','{}',now(),now());
update public.profiles set username='VerifyOwner',username_normalized='verifyowner',display_name='Verify Owner',credit_name='Verify Owner',profile_completed_at=now()
where id='b0000000-0000-4000-8000-000000000001';

select has_table('private','asset_verification_jobs','private job table exists');
select has_function('public','complete_source_upload',array['uuid'],'completion command exists');
select has_function('public','operator_claim_source_verification',array['uuid','uuid'],'claim command exists');
select ok(has_function_privilege('service_role','public.operator_claim_source_verification(uuid,uuid)','EXECUTE'),'service role can claim');
select ok(not has_table_privilege('authenticated','private.asset_verification_jobs','SELECT'),'authenticated cannot read jobs directly');

set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.reserve_source_asset('b1000000-0000-4000-8000-000000000001',1024,'first.wav','audio/wav',1000,null)$$,'owner reserves first asset');
reset role;
create temp table first_id as select asset_id from public.asset_uploads where request_id='b1000000-0000-4000-8000-000000000001';
insert into storage.objects(id,bucket_id,name,owner_id,metadata)
select gen_random_uuid(),a.bucket,a.object_path,a.owner_id,jsonb_build_object('size',1024)
from public.assets a join first_id i on i.asset_id=a.id;
grant select on first_id to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.complete_source_upload((select asset_id from first_id))$$,'completion enqueues atomically');
reset role;
select is((select count(*) from private.asset_verification_jobs),1::bigint,'one job is enqueued');
set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select is((select verification_state from public.get_source_verification_status((select asset_id from first_id))),'queued','owner sees queued status');
reset role;
create temp table first_claim as
select * from public.operator_claim_source_verification((select asset_id from first_id),null);
select is((select count(*) from first_claim),1::bigint,'eligible job is claimed once');
select is((select attempt_count from first_claim),1::smallint,'first claim records attempt one');
select is((select count(*) from public.operator_claim_source_verification((select asset_id from first_claim),null)),0::bigint,'active lease prevents duplicate claim');
select lives_ok($$select public.operator_complete_source_verification((select asset_id from first_claim),(select lease_token from first_claim),'audio/wav',1024::bigint,repeat('a',64),1000,44100,2::smallint,'source-audio-v2')$$,'lease-bound completion succeeds');
select is((select status::text from public.assets where id=(select asset_id from first_claim)),'ready','asset becomes ready');
select is((select state from private.asset_verification_jobs where asset_id=(select asset_id from first_claim)),'succeeded','job becomes succeeded');
select is((select source_bytes from public.user_storage_usage where user_id='b0000000-0000-4000-8000-000000000001'),1024::bigint,'ready quota moves once');
select is((select reserved_source_bytes from public.user_storage_usage where user_id='b0000000-0000-4000-8000-000000000001'),0::bigint,'reservation is released on success');
select is((select count(*) from public.asset_credits where asset_id=(select asset_id from first_claim)),1::bigint,'creator credit is created once');
select throws_ok($$select public.operator_fail_source_verification((select asset_id from first_claim),(select lease_token from first_claim),'unreadable_audio')$$,'P0001','asset_verification_lease_invalid','stale terminal command is rejected');

set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.reserve_source_asset('b1000000-0000-4000-8000-000000000002',2048,'second.flac','audio/flac',1000,null)$$,'owner reserves retry asset');
reset role;
create temp table second_id as select asset_id from public.asset_uploads where request_id='b1000000-0000-4000-8000-000000000002';
insert into storage.objects(id,bucket_id,name,owner_id,metadata)
select gen_random_uuid(),a.bucket,a.object_path,a.owner_id,jsonb_build_object('size',2048)
from public.assets a join second_id i on i.asset_id=a.id;
grant select on second_id to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.complete_source_upload((select asset_id from second_id))$$,'retry asset completion enqueues');
reset role;
create temp table second_claim as
select * from public.operator_claim_source_verification((select asset_id from second_id),null);
select is((select public.operator_retry_source_verification(asset_id,lease_token,'download_failed') from second_claim),'retry_wait','first transient failure waits');
update private.asset_verification_jobs set next_attempt_at=statement_timestamp()-interval '1 second' where asset_id=(select asset_id from second_claim);
create temp table second_claim_again as
select * from public.operator_claim_source_verification((select asset_id from second_claim),null);
select is((select attempt_count from second_claim_again),2::smallint,'retry claim records second attempt');
select is((select public.operator_retry_source_verification(asset_id,lease_token,'worker_error') from second_claim_again),'dead','second transient failure stops automatically');
grant select on second_claim to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select is((select verification_state from public.get_source_verification_status((select asset_id from second_claim))),'dead','owner sees dead state');
reset role;
update private.asset_verification_jobs set updated_at=statement_timestamp()-interval '31 seconds' where asset_id=(select asset_id from second_claim);
set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select is(public.retry_source_verification((select asset_id from second_claim)),'pending','owner can restart bytes after cooldown');

select lives_ok($$select public.reserve_source_asset('b1000000-0000-4000-8000-000000000003',4096,'third.mp3','audio/mpeg',1000,null)$$,'owner reserves invalid asset');
reset role;
create temp table third_id as select asset_id from public.asset_uploads where request_id='b1000000-0000-4000-8000-000000000003';
insert into storage.objects(id,bucket_id,name,owner_id,metadata)
select gen_random_uuid(),a.bucket,a.object_path,a.owner_id,jsonb_build_object('size',4096)
from public.assets a join third_id i on i.asset_id=a.id;
grant select on third_id to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.complete_source_upload((select asset_id from third_id))$$,'invalid asset completion enqueues');
reset role;
create temp table third_claim as
select * from public.operator_claim_source_verification((select asset_id from third_id),null);
select lives_ok($$select public.operator_fail_source_verification((select asset_id from third_claim),(select lease_token from third_claim),'unsupported_format')$$,'permanent failure is lease-bound');
select is((select status::text from public.assets where id=(select asset_id from third_claim)),'failed','permanent failure marks asset failed');
select is((select state from private.asset_verification_jobs where asset_id=(select asset_id from third_claim)),'permanent_failed','job records permanent failure');
select is((select reserved_source_bytes from public.user_storage_usage where user_id='b0000000-0000-4000-8000-000000000001'),2048::bigint,'only retry asset remains reserved');
select is((select count(*) from private.asset_quota_drift() where expected_ready<>recorded_ready or expected_reserved<>recorded_reserved),0::bigint,'quota projections do not drift');

select * from finish();
rollback;
