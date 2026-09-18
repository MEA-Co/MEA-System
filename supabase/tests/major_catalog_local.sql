-- Synthetic catalog smoke test. No production data; every fixture is rolled back.
begin;
create temporary table catalog_fixture as
select gen_random_uuid() as field_id, gen_random_uuid() as other_field_id,
  gen_random_uuid() as major_id, gen_random_uuid() as keyword_id,
  gen_random_uuid() as thinking_id, gen_random_uuid() as other_thinking_id;
grant select on catalog_fixture to authenticated, anon;

insert into public.fields(id,name,description,sort_order)
select field_id,'로컬 검증 계열','검증 설명',900001 from catalog_fixture
union all select other_field_id,'로컬 다른 계열','검증 설명',900002 from catalog_fixture;
insert into public.majors(id,field_id,name,description,group_name,sort_order)
select major_id,field_id,'로컬 검증 전공','전공 설명','검증 그룹',900001 from catalog_fixture;
insert into public.major_disciplinary_perspectives(major_id,description)
select major_id,'검증 관점' from catalog_fixture;
insert into public.major_keywords(id,major_id,name,description,sort_order)
select keyword_id,major_id,'검증 키워드','키워드 설명',1 from catalog_fixture;
insert into public.keyword_examples(keyword_id,label,sort_order)
select keyword_id,'검증 예시',1 from catalog_fixture;
insert into public.field_thinking_modes(id,field_id,code,name,description,sort_order)
select thinking_id,field_id,'local_test','계열 사고','설명',1 from catalog_fixture
union all select other_thinking_id,other_field_id,'other_test','다른 계열 사고','설명',1 from catalog_fixture;

-- Trigger must reject a refinement attached to a different field.
do $$
begin
  begin
    insert into public.major_thinking_modes(major_id,parent_id,relation,code,name,description,sort_order)
    select major_id,other_thinking_id,'refine','bad','잘못된 연결','설명',1 from catalog_fixture;
    raise exception 'Cross-field refinement unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> '다른 계열 항목을 구체화할 수 없습니다' then raise; end if;
  end;
end $$;

set local role authenticated;
do $$
declare result jsonb; mid uuid;
begin
  select major_id into mid from catalog_fixture;
  result := public.get_major_value_context(array[mid]);
  if result #>> '{majors,0,major,name}' is distinct from '로컬 검증 전공'
    or result #>> '{majors,0,keywords,0,examples,0,label}' is distinct from '검증 예시'
    or result #>> '{majors,0,thinking_modes,0,name}' is distinct from '계열 사고' then
    raise exception 'Catalog RPC did not join restored tables/views';
  end if;
  result := public.get_major_value_context(array[mid],false);
  if result #> '{majors,0,keywords}' is distinct from 'null'::jsonb then
    raise exception 'Keyword exclusion failed';
  end if;
  begin
    update public.majors set name='unauthorized' where id=mid;
    raise exception 'Authenticated catalog write unexpectedly accepted';
  exception when insufficient_privilege then null;
  end;
end $$;

set local role anon;
do $$
declare mid uuid;
begin
  select major_id into mid from catalog_fixture;
  if not exists(select 1 from public.majors where id=mid) then
    raise exception 'Anonymous catalog read failed';
  end if;
  begin
    perform public.get_major_value_context(array[mid]);
    raise exception 'Anonymous metadata RPC unexpectedly accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.major_effective_thinking_modes;
    raise exception 'Anonymous metadata view unexpectedly exposed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
