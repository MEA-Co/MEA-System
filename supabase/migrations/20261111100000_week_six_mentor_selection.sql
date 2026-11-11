begin;
set local lock_timeout = '5s';

-- Check question IDs are the original placements, stable across environments.
create temporary table week_six_omissions (
  week integer, original_number integer, check_question uuid primary key
) on commit drop;
insert into week_six_omissions values
  (1, 1, '86fcdaec-b9e5-46cd-b9d0-722dc2bcb336'),
  (1, 2, '08a06189-dc9c-402b-acc1-c20b76359dc0'),
  (1, 3, '5163b120-a0f7-4bb9-848b-5d3bd107abf9'),
  (1, 4, 'd5d24611-d454-4997-a2b1-62538627d7a1'),
  (1, 5, '8d00ec70-94a1-45b0-9782-c9a709431c69'),
  (2, 1, 'a815a75e-ea61-404d-9e1a-36834af4c050'),
  (2, 3, '37fa5c7a-54d4-4455-9e97-0167ef921f89'),
  (2, 4, '94160ee8-a803-4f16-af45-80280bd3641a'),
  (2, 5, 'b0362473-fff6-4eb2-90ef-125146e1704c'),
  (2, 9, 'c09624d5-e906-46db-a032-7d0e0983dd0f'),
  (3, 3, 'af7a4be3-86c5-4f8d-9e25-39eb5906758f'),
  (3, 5, 'a3821346-144b-4421-80d5-fc754f773905'),
  (3, 6, '71659496-b14b-4d3c-81ae-312a6f37d78e'),
  (3, 7, '4322762d-2e5f-474d-8dcf-484906f37462'),
  (3, 8, '8c8da3c7-d8e0-4b31-9b9f-0ef84529a8d0'),
  (3, 10, '4778c0bc-59fc-4de3-9bc3-da41f04f7170'),
  (3, 11, 'f45d6dc7-deec-491e-9c2b-45bfc0385409'),
  (3, 13, '0c508eb5-0c3e-4759-abe6-739f3fa5c36a'),
  (3, 15, '7085113e-b6f3-4d48-85c5-2073b5c1fd9d'),
  (3, 17, '39b3ac73-78da-40fb-8402-b30ac1d68e33'),
  (4, 6, 'f5fec47f-1a6d-46e5-83ea-b6eef3d77443'),
  (4, 7, '1384361b-b7ad-463b-a700-a8cff7365de2'),
  (4, 10, 'cb31c42f-cf8b-466d-9508-98d54599de33'),
  (4, 13, '0bed0cb7-c111-41ef-9fb6-3aed2d2c1325'),
  (5, 1, '6c5160ba-0458-433f-a2bd-69ed7dd1a26c'),
  (5, 2, '59758204-1553-45f2-b2b5-dd1f9d5a7eb6'),
  (5, 5, '2f7c27f8-1c5c-41b0-acfc-7cd387184278'),
  (5, 6, '167e2a1c-7c62-40b5-8de2-4d41a899c8b4'),
  (5, 7, '313eadf4-7b2b-4d24-879b-d97f17e0344a'),
  (5, 9, 'da5d0df8-dcb8-4f2d-a1ae-748a55aa3436'),
  (5, 12, 'fb4952cf-67f1-45dd-80da-f1c6a3bb5d42'),
  (5, 13, '420df2ff-9f2c-4ffd-aa9d-2dcbdc59ab32'),
  (5, 16, '6fd8d2fe-affc-4196-a301-453fd0942ca5');

do $$
declare
  target constant uuid := 'ffc36b8c-73b7-4664-975b-2263b064b066';
  doc public.questionnaires%rowtype;
  removed integer;
begin
  select * into doc from public.questionnaires where id=target for update;
  if not found then return; end if;
  if doc.status <> 'in_review' or doc.archived_at is not null then
    raise exception 'Week six must be in review';
  end if;
  if (select count(*) from public.questionnaire_questions where questionnaire_id=target) <> 75
    or (select count(*) from week_six_omissions o
      join public.questionnaire_questions p on p.source_question_id=o.check_question and p.questionnaire_id=target
      join public.questionnaire_sections s on s.id=p.section_id
      where s.position+1=o.week and p.position+1=o.original_number) <> 33 then
    raise exception 'Week six placements differ from the reviewed list';
  end if;

  -- Delete review requests only for the dedicated week-six check questions.
  -- Retain every source question, its reviews and all prior submissions.
  delete from public.question_review_requests r using public.questionnaire_questions p
    where p.questionnaire_id=target and p.source_question_id=r.question_id
      and (r.origin_questionnaire_id is null or r.origin_questionnaire_id=target)
      and not exists (select from public.questionnaire_questions other
        where other.source_question_id=r.question_id and other.questionnaire_id<>target);

  delete from public.questionnaire_questions p using week_six_omissions o
    where p.questionnaire_id=target and p.source_question_id=o.check_question;
  get diagnostics removed = row_count;
  if removed <> 33 then raise exception 'Unexpected omission count'; end if;

  with remaining as (
    select id,row_number() over(partition by section_id order by position)-1 as pos
    from public.questionnaire_questions where questionnaire_id=target
  )
  update public.questionnaire_questions p set position=r.pos
    from remaining r where p.id=r.id and p.position<>r.pos;

  update public.questionnaires set revision=revision+1,updated_at=now(),
    last_save_id=null,last_save_hash=null where id=target;
end $$;
commit;
