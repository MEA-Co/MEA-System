begin;
do $$
declare field jsonb; one uuid:=gen_random_uuid(); two uuid:=gen_random_uuid(); value text;
begin
 field:=jsonb_build_object('kind','scale','scaleMax',5);
 if not private.question_field_response_valid(field,'5',true) or private.question_field_response_valid(field,'6',false) then raise exception 'Scale bounds'; end if;
 field:=jsonb_build_object('kind','multiple','options',jsonb_build_array(jsonb_build_object('id',one,'label','일반'),jsonb_build_object('id',two,'label','기타','isOther',true)),'choiceAllowText',true);
 value:=jsonb_build_object('choices',jsonb_build_array(one,jsonb_build_object('id',two,'entryId','a','text','직접 1'),jsonb_build_object('id',two,'entryId','b','text','직접 2')),'text','추가 서술')::text;
 if not private.question_field_response_valid(field,value,true) then raise exception 'Multiple direct entry rejected'; end if;
 if private.question_field_response_valid(field,jsonb_build_array(one,one)::text,false) then raise exception 'Duplicate choices allowed'; end if;
 if private.question_field_response_valid(field,jsonb_build_array(gen_random_uuid())::text,false) then raise exception 'Foreign option allowed'; end if;
 value:=jsonb_build_array(jsonb_build_object('id',two,'text',''))::text;
 if not private.question_field_response_valid(field,value,false) or private.question_field_response_valid(field,value,true) then raise exception 'Incomplete other choice'; end if;
 if private.question_field_response_valid('{"kind":"text"}','::mea-rich-text:v1::{"type":"doc","content":[{"type":"paragraph"}]}',true) then raise exception 'Empty rich text accepted'; end if;
end $$;
rollback;
