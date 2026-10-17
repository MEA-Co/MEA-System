begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
alter table public.service_announcements
 add column color text not null default 'yellow'
 constraint service_announcements_color_check check (color in ('red','yellow','green'));
grant update (color) on public.service_announcements to authenticated;
commit;
