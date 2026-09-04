alter table profiles add column if not exists no_show_count int default 0;

-- reviews were previously only allowed on cleanly 'settled' rentals — now
-- also allowed after a dispute or no-show, since that's often exactly when
-- a rating matters most (e.g. rating a renter who damaged an item)
drop policy if exists "participants can leave one review per rental" on reviews;
create policy "participants can leave one review per rental" on reviews for insert
  with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from rentals r where r.id = rental_id
      and r.stage in ('settled', 'disputed', 'no_show')
      and (r.owner_id = auth.uid() or r.renter_id = auth.uid())
      and reviewee_id in (r.owner_id, r.renter_id)
      and reviewee_id != auth.uid()
    )
  );
