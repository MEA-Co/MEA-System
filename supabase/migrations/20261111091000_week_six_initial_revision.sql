-- A seeded review document must have a saved revision to enter publication.
update public.questionnaires
set revision = 1
where id = 'ffc36b8c-73b7-4664-975b-2263b064b066'
  and status = 'in_review' and revision = 0;
