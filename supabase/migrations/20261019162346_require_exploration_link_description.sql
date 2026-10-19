-- Keep existing rows and incomplete local drafts; validate future confirmations.
do $migration$
declare
 definition text := pg_get_functiondef('private.save_exploration_link(uuid,jsonb,integer,uuid)'::regprocedure);
 needle text := 'or length(p_content->>''description'')>5000 then';
begin
 if position(needle in definition)=0 then
   raise exception 'Unexpected save_exploration_link definition';
 end if;
 execute replace(definition,needle,
   'or (p_content->>''description'') !~ ''[^[:space:]]'' or length(p_content->>''description'')>5000 then');
end $migration$;
