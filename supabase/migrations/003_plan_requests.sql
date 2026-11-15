begin;
create table public.plan_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  plan text not null check(plan in ('basic','plus')),
  included_template text not null check(included_template in ('essential','studio','ledger','letterhead','accent')),
  status text not null default 'pending' check(status in ('pending','approved','declined')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users on delete set null
);
create unique index plan_requests_one_pending on public.plan_requests(workspace_id) where status='pending';
create index plan_requests_history on public.plan_requests(workspace_id,created_at desc);
alter table public.plan_requests enable row level security;
revoke all on public.plan_requests from public,anon,authenticated;
grant select,insert(workspace_id,plan,included_template) on public.plan_requests to authenticated;
create policy plan_request_read on public.plan_requests for select to authenticated
  using(public.owns_workspace(workspace_id) or public.is_admin());
create policy plan_request_insert on public.plan_requests for insert to authenticated
  with check(public.owns_workspace(workspace_id) and status='pending');

create function public.review_plan_request(target uuid, approve boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare
  request public.plan_requests%rowtype;
  expiry timestamptz;
begin
  if not public.is_admin() then raise exception 'Superadmin access required' using errcode='42501'; end if;
  select * into request from public.plan_requests where id=target for update;
  if not found or request.status <> 'pending' then return false; end if;

  if approve then
    perform 1 from public.workspaces where id=request.workspace_id for update;
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
revoke execute on function public.review_plan_request(uuid,boolean) from public;
grant execute on function public.review_plan_request(uuid,boolean) to authenticated;
commit;