begin;
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users on delete cascade,
  profile jsonb not null,
  next_number integer not null default 1
);
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  number integer,
  status text not null default 'draft' check (status in ('draft','issued','paid')),
  data jsonb not null,
  seller jsonb,
  updated_at timestamptz not null default now(),
  unique (workspace_id, number)
);
create index invoices_workspace_updated on public.invoices(workspace_id, updated_at desc);
create table public.platform_admins (user_id uuid primary key references auth.users on delete cascade);
create table public.template_entitlements (
  workspace_id uuid references public.workspaces on delete cascade,
  template text check (template in ('studio','ledger','letterhead','accent')),
  primary key (workspace_id, template)
);
alter table public.workspaces enable row level security;
alter table public.invoices enable row level security;
alter table public.platform_admins enable row level security;
alter table public.template_entitlements enable row level security;

create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.platform_admins where user_id = auth.uid());
$$;
create function public.owns_workspace(target uuid) returns boolean language sql stable set search_path = '' as $$
  select exists(select 1 from public.workspaces where id = target and owner_id = auth.uid());
$$;
create policy workspace_read on public.workspaces for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy workspace_add on public.workspaces for insert to authenticated with check (owner_id = auth.uid());
create policy workspace_edit on public.workspaces for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy invoice_read on public.invoices for select to authenticated using (public.owns_workspace(workspace_id));
create policy invoice_add on public.invoices for insert to authenticated with check (public.owns_workspace(workspace_id));
create policy invoice_edit on public.invoices for update to authenticated using (status = 'draft' and public.owns_workspace(workspace_id)) with check (status = 'draft' and public.owns_workspace(workspace_id));
create policy invoice_delete on public.invoices for delete to authenticated using (status = 'draft' and public.owns_workspace(workspace_id));
create policy entitlement_read on public.template_entitlements for select to authenticated using (public.owns_workspace(workspace_id) or public.is_admin());
create policy entitlement_add on public.template_entitlements for insert to authenticated with check (public.is_admin());
create policy entitlement_delete on public.template_entitlements for delete to authenticated using (public.is_admin());

revoke all on public.workspaces, public.invoices, public.platform_admins, public.template_entitlements from anon, authenticated;
grant select, insert(owner_id, profile), update(profile) on public.workspaces to authenticated;
grant select, insert(workspace_id, data), update(data), delete on public.invoices to authenticated;
grant select, insert, delete on public.template_entitlements to authenticated;

create function public.touch_invoice() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger invoice_changed before update on public.invoices for each row execute function public.touch_invoice();

create function public.issue_invoice(target uuid, payload jsonb) returns integer
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
  if coalesce(payload->>'template','') <> 'essential' and not exists(
    select 1 from public.template_entitlements where workspace_id = workspace.id and template = payload->>'template'
  ) then raise exception 'Premium template is locked'; end if;
  update public.invoices set status='issued', number=workspace.next_number, seller=workspace.profile, data=payload where id=target;
  update public.workspaces set next_number=next_number+1 where id=workspace.id;
  return workspace.next_number;
end;
$$;

create function public.mark_invoice_paid(target uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.invoices i set status = 'paid' where i.id = target and i.status = 'issued'
    and exists(select 1 from public.workspaces w where w.id=i.workspace_id and w.owner_id=auth.uid());
end;
$$;
revoke execute on function public.is_admin(), public.owns_workspace(uuid), public.issue_invoice(uuid,jsonb), public.mark_invoice_paid(uuid) from public;
grant execute on function public.is_admin(), public.owns_workspace(uuid), public.issue_invoice(uuid,jsonb), public.mark_invoice_paid(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('logos','logos',false,2097152,array['image/png','image/jpeg']);
create policy logo_read on storage.objects for select to authenticated using (bucket_id='logos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy logo_add on storage.objects for insert to authenticated with check (bucket_id='logos' and (storage.foldername(name))[1]=auth.uid()::text);
commit;