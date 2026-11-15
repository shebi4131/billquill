-- Replace the placeholder with the UUID from Authentication > Users.
-- The account must exist before assigning its platform role.
do $$
declare admin_uuid uuid := 'a0294fe7-057a-406b-a94b-4b9a127a03f3';
begin
  if not exists(select 1 from auth.users where id=admin_uuid) then
    raise exception 'Set admin_uuid to the intended Supabase Auth user UUID first';
  end if;
  insert into public.platform_admins(user_id) values(admin_uuid) on conflict do nothing;
end;
$$;