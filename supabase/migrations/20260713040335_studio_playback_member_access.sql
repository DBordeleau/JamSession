-- Extend private source playback to active project members without widening
-- upload or mutation privileges. Project membership and immutable revision
-- references are both required.
create function private.is_project_member(p_project_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select private.is_active_project_actor())
    and exists (
      select 1 from public.project_members m
      where m.project_id = p_project_id
        and m.user_id = (select auth.uid())
    )
$$;
revoke all on function private.is_project_member(uuid) from public, anon;
grant execute on function private.is_project_member(uuid) to authenticated;

drop policy if exists owner_projects_read on public.projects;
create policy member_projects_read on public.projects for select to authenticated
using ((select private.is_project_member(projects.id)));

drop policy if exists owner_members_read on public.project_members;
create policy self_membership_read on public.project_members for select to authenticated
using (user_id = (select auth.uid()) and (select private.is_active_project_actor()));

drop policy if exists owner_genres_read on public.project_genres;
create policy member_genres_read on public.project_genres for select to authenticated
using ((select private.is_project_member(project_genres.project_id)));
drop policy if exists owner_tags_read on public.project_tags;
create policy member_tags_read on public.project_tags for select to authenticated
using ((select private.is_project_member(project_tags.project_id)));

drop policy if exists member_revisions_read on public.project_revisions;
create policy member_revisions_read on public.project_revisions for select to authenticated
using ((select private.is_project_member(project_revisions.project_id)));

drop policy if exists member_revision_tracks_read on public.revision_tracks;
create policy member_revision_tracks_read on public.revision_tracks for select to authenticated
using (exists (
  select 1 from public.project_revisions r
  where r.id = revision_tracks.revision_id
    and (select private.is_project_member(r.project_id))
));

drop policy if exists owned_assets_read on public.assets;
create policy owned_or_referenced_assets_read
on public.assets for select to authenticated
using (
  (select private.is_active_project_actor())
  and (
    owner_id = (select auth.uid())
    or (
      kind = 'source_audio'
      and status = 'ready'
      and deleted_at is null
      and exists (
        select 1
        from public.revision_tracks rt
        join public.project_revisions r on r.id = rt.revision_id
        where rt.asset_id = assets.id
          and (select private.is_project_member(r.project_id))
      )
    )
  )
);

drop policy if exists owned_source_read on storage.objects;
create policy owned_or_referenced_source_read
on storage.objects for select to authenticated
using (
  bucket_id = 'source-audio'
  and (select private.is_active_project_actor())
  and exists (
    select 1
    from public.assets a
    where a.bucket = bucket_id
      and a.object_path = name
      and a.kind = 'source_audio'
      and a.deleted_at is null
      and (
        (a.owner_id = (select auth.uid()) and a.status in ('processing', 'ready'))
        or (
          a.status = 'ready'
          and exists (
            select 1
            from public.revision_tracks rt
            join public.project_revisions r on r.id = rt.revision_id
            where rt.asset_id = a.id
              and (select private.is_project_member(r.project_id))
          )
        )
      )
  )
);
