begin;
create table public.workspace_subscriptions (
  workspace_id uuid primary key references public.workspaces on delete cascade,
  plan text not null check(plan in ('basic','plus')),
  included_template text not null check(included_template in ('essential','studio','ledger','letterhead','accent')),
  expires_at timestamptz not null
);
alter table public.workspace_subscriptions enable row level security;
revoke all on public.workspace_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.workspace_subscriptions to authenticated;
create policy subscription_read on public.workspace_subscriptions for select to authenticated
  using (public.owns_workspace(workspace_id) or public.is_admin());
create policy subscription_admin on public.workspace_subscriptions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Essential is also eligible as a permanently purchased design.
alter table public.template_entitlements drop constraint template_entitlements_template_check;
alter table public.template_entitlements add constraint template_entitlements_template_check
  check(template in ('essential','studio','ledger','letterhead','accent'));

drop policy invoice_add on public.invoices;
create policy invoice_add on public.invoices for insert to authenticated with check (
  public.owns_workspace(workspace_id) and exists (
    select 1 from public.workspace_subscriptions s where s.workspace_id=invoices.workspace_id and s.expires_at>now()
  )
);

create function public.template_available(target uuid, design text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_subscriptions s join public.workspaces w on w.id=s.workspace_id
    where s.workspace_id=target and w.owner_id=auth.uid() and s.expires_at>now()
      and design in ('essential','studio','ledger','letterhead','accent')
      and (s.plan='plus' or s.included_template=design or exists(
        select 1 from public.template_entitlements t where t.workspace_id=target and t.template=design
      ))
  );
$$;
revoke execute on function public.template_available(uuid,text) from public;
grant execute on function public.template_available(uuid,text) to authenticated;

create or replace function public.issue_invoice(target uuid, payload jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  workspace public.workspaces%rowtype;
  current_invoice public.invoices%rowtype;
  item jsonb;
begin
  select * into workspace from public.workspaces where owner_id = auth.uid() for update;
  select * into current_invoice from public.invoices where id = target and workspace_id = workspace.id for update;
  if not found then raise exception 'Invoice unavailable'; end if;
  if current_invoice.status <> 'draft' then return current_invoice.number; end if;
  if coalesce(trim(payload->>'client'),'') = '' or coalesce(trim(workspace.profile->>'name'),'') = ''
    or coalesce(payload->>'date','') !~ '^\d{4}-\d{2}-\d{2}$'
    or coalesce(payload->>'currency','') not in ('PKR','USD','GBP','EUR','CAD','AUD','AED','SAR','JPY')
    or jsonb_typeof(payload->'items') is distinct from 'array' then
    raise exception 'Complete the business, client, date, currency and line items';
  end if;
  if jsonb_array_length(payload->'items') not between 1 and 100 then raise exception 'Invalid item count'; end if;
  for item in select value from jsonb_array_elements(payload->'items') loop
    if coalesce(trim(item->>'description'),'') = '' or coalesce(item->>'quantity','') !~ '^\d{1,8}(\.\d{1,4})?$'
      or coalesce(item->>'unitPrice','') !~ '^\d{1,8}(\.\d{1,4})?$' then raise exception 'Complete each item'; end if;
    if (item->>'quantity')::numeric <= 0 then raise exception 'Enter a positive quantity'; end if;
  end loop;
  if not public.template_available(workspace.id, payload->>'template') then raise exception 'An active plan and template access are required'; end if;
  update public.invoices set status='issued', number=workspace.next_number, seller=workspace.profile, data=payload where id=target;
  update public.workspaces set next_number=next_number+1 where id=workspace.id;
  return workspace.next_number;
end;
$$;
revoke execute on function public.issue_invoice(uuid,jsonb) from public;
grant execute on function public.issue_invoice(uuid,jsonb) to authenticated;

create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  topic text not null check(topic in ('custom-letterhead','subscription','support')),
  message text not null,
  created_at timestamptz not null default now()
);
create index contact_email_recent on public.contact_requests(lower(email),created_at desc);
alter table public.contact_requests enable row level security;
revoke all on public.contact_requests from public, anon, authenticated;
grant select on public.contact_requests to authenticated;
create policy contact_admin on public.contact_requests for select to authenticated using(public.is_admin());
create function public.submit_contact(sender text, reply_to text, subject text, body text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if sender is null or length(trim(sender)) not between 2 and 100 or reply_to is null
    or length(reply_to)>254 or reply_to !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or body is null or length(trim(body)) not between 10 and 2000 then raise exception 'Invalid request'; end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(reply_to),0));
  if (select count(*) from public.contact_requests where lower(email)=lower(reply_to) and created_at>now()-interval '1 hour')>=3 then
    raise exception 'Contact rate limit reached';
  end if;
  insert into public.contact_requests(name,email,topic,message) values(trim(sender),lower(reply_to),subject,trim(body));
end;
$$;
revoke execute on function public.submit_contact(text,text,text,text) from public;
grant execute on function public.submit_contact(text,text,text,text) to anon,authenticated;
commit;