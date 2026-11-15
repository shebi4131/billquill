begin;
alter table public.workspaces drop constraint workspaces_owner_id_key;
alter table public.workspaces add column status text not null default 'active' check(status in ('active','suspended','removed'));
alter table public.workspaces add column created_at timestamptz not null default now();
alter table public.workspaces add column status_changed_at timestamptz;
alter table public.workspaces add column status_changed_by uuid;
create index workspaces_by_owner on public.workspaces(owner_id,created_at,id);

create or replace function public.owns_workspace(target uuid) returns boolean
language sql stable set search_path='' as $$
  select exists(select 1 from public.workspaces where id=target and owner_id=auth.uid() and status='active');
$$;
drop policy workspace_edit on public.workspaces;
create policy workspace_edit on public.workspaces for update to authenticated
  using(owner_id=auth.uid() and status='active') with check(owner_id=auth.uid() and status='active');

create function public.change_workspace_status(target uuid, desired text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if desired not in ('active','suspended','removed') then return false; end if;
  update public.workspaces set status=desired,status_changed_at=now(),status_changed_by=auth.uid()
    where id=target and status <> 'removed' and status <> desired
      and (public.is_admin() or (owner_id=auth.uid() and desired='removed'));
  return found;
end;
$$;
revoke execute on function public.change_workspace_status(uuid,text) from public;
grant execute on function public.change_workspace_status(uuid,text) to authenticated;

alter table public.invoices add column created_at timestamptz;
alter table public.invoices alter column created_at set default now();
alter table public.invoices add column created_by uuid default auth.uid();
alter table public.invoices add column updated_by uuid;
alter table public.invoices add column issued_at timestamptz;
alter table public.invoices add column paid_at timestamptz;
alter table public.invoices add column archived_at timestamptz;
alter table public.invoices add column archived_by uuid;
revoke delete on public.invoices from authenticated;
drop policy invoice_delete on public.invoices;
drop policy invoice_edit on public.invoices;
create policy invoice_edit on public.invoices for update to authenticated
  using(status='draft' and archived_at is null and public.owns_workspace(workspace_id))
  with check(status='draft' and archived_at is null and public.owns_workspace(workspace_id));

create or replace function public.touch_invoice() returns trigger language plpgsql set search_path='' as $$
begin
  new.updated_at:=now();
  new.updated_by:=auth.uid();
  if old.status='draft' and new.status='issued' then new.issued_at:=now(); end if;
  if old.status='issued' and new.status='paid' then new.paid_at:=now(); end if;
  return new;
end;
$$;

create function public.archive_invoice(target uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  update public.invoices set archived_at=now(),archived_by=auth.uid()
    where id=target and archived_at is null and public.owns_workspace(workspace_id);
  return found;
end;
$$;
revoke execute on function public.archive_invoice(uuid) from public;
grant execute on function public.archive_invoice(uuid) to authenticated;

create or replace function public.mark_invoice_paid(target uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.invoices set status='paid' where id=target and status='issued' and archived_at is null
    and public.owns_workspace(workspace_id);
end;
$$;

create or replace function public.issue_invoice(target uuid, payload jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  workspace public.workspaces%rowtype;
  current_invoice public.invoices%rowtype;
  item jsonb;
begin
  select * into workspace from public.workspaces where id=(select workspace_id from public.invoices where id=target) and owner_id=auth.uid() and status='active' for update;
  select * into current_invoice from public.invoices where id = target and workspace_id = workspace.id and archived_at is null for update;
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

create or replace function public.template_available(target uuid, design text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_subscriptions s join public.workspaces w on w.id=s.workspace_id
    where s.workspace_id=target and w.owner_id=auth.uid() and w.status='active' and s.expires_at>now()
      and design in ('essential','studio','ledger','letterhead','accent')
      and (s.plan='plus' or s.included_template=design or exists(
        select 1 from public.template_entitlements t where t.workspace_id=target and t.template=design
      ))
  );
$$;

create or replace function public.review_plan_request(target uuid, approve boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare
  request public.plan_requests%rowtype;
  expiry timestamptz;
begin
  if not public.is_admin() then raise exception 'Superadmin access required' using errcode='42501'; end if;
  select * into request from public.plan_requests where id=target for update;
  if not found or request.status <> 'pending' then return false; end if;

  if approve then
    perform 1 from public.workspaces where id=request.workspace_id and status='active' for update;
    if not found then raise exception 'The business must be active before approval'; end if;
    select expires_at into expiry from public.workspace_subscriptions
      where workspace_id=request.workspace_id and plan=request.plan for update;
    expiry := ((greatest(now(),expiry) at time zone 'Asia/Karachi') + interval '1 month') at time zone 'Asia/Karachi';
    insert into public.workspace_subscriptions(workspace_id,plan,included_template,expires_at)
      values(request.workspace_id,request.plan,request.included_template,expiry)
      on conflict(workspace_id) do update set
        plan=excluded.plan,included_template=excluded.included_template,expires_at=excluded.expires_at;
  end if;

  update public.plan_requests set status=case when approve then 'approved' else 'declined' end,
    reviewed_at=now(),reviewed_by=auth.uid() where id=target;
  return true;
end;
$$;

commit;
