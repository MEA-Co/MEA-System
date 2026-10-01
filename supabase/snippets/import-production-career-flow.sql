-- Target: epwlcallocdjkmgdmtlv (production), SQL Editor as postgres.
-- One-question data import; no schema migration, questionnaire placement, or answers.
-- Exported from local DB on 2026-10-01. Keep question/field IDs and row labels.
-- To preview: replace the final COMMIT with ROLLBACK, then run the whole file.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $import$
declare
  creator_id constant uuid := '38b5ef9f-cf72-4263-9465-126c20ad0260';
  document constant jsonb := $career_flow${
  "id": "5f6064ad-1dd6-4e0d-95dd-611ccacbce92",
  "title": "진로 흐름",
  "fields": [
    {
      "id": "f4689fea-ba91-400f-82be-f0b1dbf185db",
      "kind": "text",
      "label": "중등"
    },
    {
      "id": "720f88bd-1ace-4b86-828f-5df7abbe0a10",
      "kind": "text",
      "label": "예비고1 (중3 11월~겨울방학)"
    },
    {
      "id": "69aae7a7-f0c5-4a91-9308-99768706f715",
      "kind": "text",
      "label": "고1-1 3월 ~ 중간고사 전"
    },
    {
      "id": "20382b2d-b52f-48d5-b033-f9c0e1789d7b",
      "kind": "text",
      "label": "고1-1 중간고사와 기말고사 사이"
    },
    {
      "id": "3d26e57d-2b74-4228-ac5a-f7a7ab400665",
      "kind": "text",
      "label": "고1-1 기말고사 후 ~ 여름방학"
    },
    {
      "id": "c1604280-a358-4b19-aa9b-e4c7b2857904",
      "kind": "text",
      "label": "고1-2 중간고사 전"
    },
    {
      "id": "104bc039-0557-4db7-b807-ae6f59b8eda5",
      "kind": "text",
      "label": "고1-2 중간고사와 기말고사 사이"
    },
    {
      "id": "5259cb93-29c3-4d6b-a1c9-244460a9429b",
      "kind": "text",
      "label": "고1-2 기말고사 후 ~ 겨울방학"
    },
    {
      "id": "be8fe74c-df9a-4484-93f2-4c4520e0b1ee",
      "kind": "text",
      "label": "고2-1 3월 ~ 중간고사 전"
    },
    {
      "id": "99fd98c2-cd40-4963-8b81-4897f5e88767",
      "kind": "text",
      "label": "고2-1 중간고사와 기말고사 사이"
    },
    {
      "id": "580c4c3b-3b9e-4b5f-a511-43f43810b8e3",
      "kind": "text",
      "label": "고2-1 기말고사 후 ~ 여름방학"
    },
    {
      "id": "98363a39-ab1b-444a-b396-1c2bdd2fdb74",
      "kind": "text",
      "label": "고2-2 중간고사 전"
    },
    {
      "id": "3b720737-82e6-44a3-999f-f2dbbef04c45",
      "kind": "text",
      "label": "고2-2 중간고사와 기말고사 사이"
    },
    {
      "id": "5b1a43ce-6dd7-48eb-82b7-f42021773043",
      "kind": "text",
      "label": "고2-2 기말고사 후 ~ 겨울방학"
    },
    {
      "id": "edeaca39-1ccc-4676-a46f-0ebf57f2bef3",
      "kind": "text",
      "label": "고3-1 3월 중간고사 전"
    },
    {
      "id": "1c7e8f92-af61-49c0-9835-a7bf496c386f",
      "kind": "text",
      "label": "고3-1 중간고사와 기말고사 사이"
    },
    {
      "id": "e6b55b64-c7e9-4e78-9bd2-e65ede7b0dc1",
      "kind": "text",
      "label": "고3-1 기말고사 후 ~ 여름방학"
    },
    {
      "id": "e75649e4-82f5-4175-8c14-2298c522a45d",
      "kind": "text",
      "label": "고3-2 9월 초 수시 원서 접수 기간 (수시 원서 전략에 따른 학과 우회 등 중심)"
    },
    {
      "id": "3f848bed-5a71-4926-ba11-703e18d8c089",
      "kind": "text",
      "label": "고 3-2 정시 원서 접수 기간 (정시 원서 전략에 따른 최종 지원 중심)"
    },
    {
      "id": "f57a4d95-2193-44e4-b299-28174045d253",
      "kind": "text",
      "label": "N수"
    }
  ],
  "prompt": "진로 흐름을 입력해주세요.",
  "details": [],
  "maxRows": 5,
  "minRows": 5,
  "rowMode": "repeatable",
  "condition": null,
  "rowLabels": [
    "희망 계열 / 학과 (변동이 있는 경우에 작성)",
    "[최초 희망 / 변동 / 확정] 등의 계기",
    "진로 희망 / 변동 등에 대한 대응",
    "진로 희망 / 변동 등에 대한 대응이 대입에 영향을 주었다고 생각하는 요소",
    "상기에 명시되지 않았지만 진로 고민을 겪는 학생에게 주고 싶은 조언 (전략)"
  ],
  "afterBlockId": null,
  "sourceBlockId": null,
  "sourceFieldId": null
}$career_flow$::jsonb;
  target_id uuid := (document->>'id')::uuid;
  existing public.questions%rowtype;
  actual jsonb;
begin
  if not exists(select 1 from public.profiles where id=creator_id and role in ('admin','consultant_lead')) then
    raise exception 'Target creator must exist as admin or consultant_lead';
  end if;
  if document->>'sourceBlockId' is not null or document->>'afterBlockId' is not null or document->>'condition' is not null then
    raise exception 'Referenced questions require a separate dependency review';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_id::text,0));
  select * into existing from public.questions where id=target_id for update;
  if found then
    select jsonb_build_object('id',q.id,'title',q.title,'prompt',q.prompt,'fields',q.fields,'rowMode',q.row_mode,'minRows',q.min_rows,'maxRows',q.max_rows,'rowLabels',q.row_labels,'sourceBlockId',q.source_block_id,'sourceFieldId',q.source_field_id,'afterBlockId',q.after_block_id,'condition',q.condition,'details',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'text',d.body,'visibleToConsultants',d.visible_to_consultants) order by d.position,d.id) from public.question_details d where d.question_id=q.id),'[]'::jsonb)) into actual from public.questions q where q.id=target_id;
    if existing.created_by<>creator_id or existing.archived_at is not null or actual is distinct from document then
      raise exception 'Existing target differs: stopped without overwriting';
    end if;
    raise notice 'Identical question already exists; no changes made';
    return;
  end if;
  if exists(select 1 from public.questions where title=document->>'title') then
    raise exception 'A different question with the same title exists; review before importing';
  end if;
  -- SQL Editor administrator context only. Local JWT settings expire at commit.
  perform set_config('request.jwt.claim.sub',creator_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',creator_id,'role','authenticated')::text,true);
  perform public.save_question(document,0,gen_random_uuid());
  select jsonb_build_object('id',q.id,'title',q.title,'prompt',q.prompt,'fields',q.fields,'rowMode',q.row_mode,'minRows',q.min_rows,'maxRows',q.max_rows,'rowLabels',q.row_labels,'sourceBlockId',q.source_block_id,'sourceFieldId',q.source_field_id,'afterBlockId',q.after_block_id,'condition',q.condition,'details',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'text',d.body,'visibleToConsultants',d.visible_to_consultants) order by d.position,d.id) from public.question_details d where d.question_id=q.id),'[]'::jsonb)) into actual from public.questions q where q.id=target_id;
  if actual is distinct from document or not exists(select 1 from public.questions where id=target_id and created_by=creator_id and archived_at is null) then
    raise exception 'Imported question verification failed';
  end if;
  raise notice 'Career-flow question imported and verified';
end $import$;

select id,created_by,title,min_rows,max_rows,jsonb_array_length(fields) as column_count
from public.questions where id='5f6064ad-1dd6-4e0d-95dd-611ccacbce92';
commit;
