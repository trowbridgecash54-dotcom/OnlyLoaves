-- OnlyLoafs — database schema, security rules and server functions
-- ---------------------------------------------------------------------
-- Apply with the Supabase CLI (`supabase db push`) or by pasting this
-- file, then the two that follow, into the Supabase SQL editor in order.
--
-- Security model
--   anon            visitors. May read visible products, the Club plan,
--                   public settings and pickup closures. Nothing else.
--   authenticated   a signed-in Supabase Auth user. Gets nothing extra
--                   unless their user id is listed in public.admins.
--   service_role    the website's server (secret key). Saves the three
--                   public forms through the submit_* functions.
--
-- Customers never read from the private tables: orders, subscription
-- records and messages are visible to administrators only.

-- ============================================================ admins

create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

-- True when the caller is a listed administrator. SECURITY DEFINER so it
-- can read public.admins from inside row-level security policies.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================ settings

-- Website settings, one row per group (business, copy, story, pickup…).
-- Rows with is_public = false are visible to administrators only.
create table public.settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  is_public  boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.pickup_closures (
  closed_on  date primary key,
  note       text not null default '',
  created_at timestamptz not null default now()
);

-- ============================================================ products

create table public.products (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name              text not null check (length(btrim(name)) > 0),
  description       text not null default '',
  price_cents       integer check (price_cents is null or price_cents >= 0),
  -- Path of the photo inside the "photos" storage bucket, or null.
  image_path        text,
  image_alt         text not null default '',
  ingredients       text,
  allergens         text,
  availability      text not null default 'available'
                      check (availability in ('available', 'limited', 'sold-out', 'coming-soon')),
  availability_note text not null default '',
  featured          boolean not null default false,
  club_eligible     boolean not null default true,
  sort_order        integer not null default 0,
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index products_display_order on public.products (sort_order, name);
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- ============================================================ orders

create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  reference           text not null unique,
  status              text not null default 'new'
                        check (status in ('new', 'confirmed', 'preparing', 'ready', 'completed', 'canceled')),
  customer_name       text not null,
  customer_email      text not null,
  customer_phone      text not null default '',
  pickup_date         date not null,
  notes               text not null default '',
  owner_notes         text not null default '',
  -- Sent by the form; a repeated submission returns the first order.
  idempotency_key     uuid not null unique,
  notification_status text not null default 'pending'
                        check (notification_status in ('pending', 'sent', 'failed', 'not-configured')),
  notification_error  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index orders_by_status on public.orders (status, created_at desc);
create index orders_by_pickup on public.orders (pickup_date);
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,
  product_id       uuid references public.products (id) on delete set null,
  -- Name and price are copied at order time so later edits don't rewrite history.
  product_name     text not null,
  unit_price_cents integer check (unit_price_cents is null or unit_price_cents >= 0),
  quantity         integer not null check (quantity > 0)
);

create index order_items_by_order on public.order_items (order_id);

-- ============================================================ the Club

create table public.subscription_plans (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  name               text not null,
  price_cents        integer not null check (price_cents >= 0),
  currency           text not null default 'USD',
  billing_interval   text not null default 'month' check (billing_interval in ('month')),
  loaves_per_period  integer not null check (loaves_per_period > 0),
  pickup_only        boolean not null default true,
  enabled            boolean not null default true,
  accepting_requests boolean not null default true,
  closed_message     text not null default '',
  max_subscribers    integer check (max_subscribers is null or max_subscribers >= 0),
  allow_mixed_loaves boolean not null default true,
  allow_pause_requests boolean not null default true,
  selection_mode     text not null default 'choose' check (selection_mode in ('choose', 'preferences')),
  tracking_period    text not null default 'calendar-month'
                       check (tracking_period in ('calendar-month', 'anniversary')),
  -- Undecided until the owner chooses. Nothing is carried forward automatically.
  unused_loaf_policy text not null default 'undecided'
                       check (unused_loaf_policy in ('undecided', 'expire', 'rollover', 'credit')),
  -- Reserved for a future Stripe Billing integration. Unused today.
  stripe_price_id    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger plans_touch before update on public.subscription_plans
  for each row execute function public.touch_updated_at();

-- Someone asked to join. Never a subscription by itself.
create table public.subscription_inquiries (
  id                          uuid primary key default gen_random_uuid(),
  reference                   text not null unique,
  status                      text not null default 'inquiry'
                                check (status in ('inquiry', 'pending-approval', 'approved', 'rejected')),
  plan_id                     uuid not null references public.subscription_plans (id),
  name                        text not null,
  email                       text not null,
  phone                       text not null default '',
  preferred_pickup_day        text not null default 'flexible',
  preferred_first_pickup_date date not null,
  requested_loaves            jsonb not null default '[]'::jsonb,
  bread_preferences           text not null default '',
  additional_requests         text not null default '',
  acknowledged_terms_at       timestamptz not null,
  subscription_id             uuid,
  owner_notes                 text not null default '',
  idempotency_key             uuid not null unique,
  notification_status         text not null default 'pending'
                                check (notification_status in ('pending', 'sent', 'failed', 'not-configured')),
  notification_error          text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index inquiries_by_status on public.subscription_inquiries (status, created_at desc);
create trigger inquiries_touch before update on public.subscription_inquiries
  for each row execute function public.touch_updated_at();

-- A membership the owner has approved.
create table public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  inquiry_id         uuid unique references public.subscription_inquiries (id),
  plan_id            uuid not null references public.subscription_plans (id),
  status             text not null default 'active' check (status in ('active', 'paused', 'canceled')),
  subscriber_name    text not null,
  subscriber_email   text not null,
  subscriber_phone   text not null default '',
  -- Copied from the plan at approval, so later plan edits don't silently
  -- change what an existing member was promised.
  price_cents        integer not null check (price_cents >= 0),
  currency           text not null default 'USD',
  loaves_per_period  integer not null check (loaves_per_period > 0),
  pickup_day         text not null default 'flexible',
  pickup_notes       text not null default '',
  started_on         date not null,
  paused_on          date,
  canceled_on        date,
  -- Reserved for a future Stripe Billing integration. Never card details.
  stripe_customer_id     text,
  stripe_subscription_id text,
  owner_notes        text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.subscription_inquiries
  add constraint inquiry_subscription_fk
  foreign key (subscription_id) references public.subscriptions (id) on delete set null;

create index subscriptions_by_status on public.subscriptions (status);
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- One allowance period ("month") of a subscription. Created on demand
-- for active subscriptions only — never in advance.
create table public.subscription_periods (
  id                      uuid primary key default gen_random_uuid(),
  subscription_id         uuid not null references public.subscriptions (id) on delete cascade,
  starts_on               date not null,
  ends_on                 date not null,
  allowance               integer not null check (allowance >= 0),
  authorized_extra_loaves integer not null default 0 check (authorized_extra_loaves >= 0),
  -- Recorded by hand. The website takes no payments.
  payment_status          text not null default 'unpaid'
                            check (payment_status in ('unpaid', 'paid', 'waived', 'refunded')),
  paid_on                 date,
  payment_note            text not null default '',
  created_at              timestamptz not null default now(),
  unique (subscription_id, starts_on),
  check (ends_on >= starts_on)
);

-- One row per loaf handed to a member. Rows are never deleted; a mistake
-- is voided, which keeps the record and gives the loaf back.
create table public.fulfillments (
  id                  uuid primary key default gen_random_uuid(),
  subscription_id     uuid not null references public.subscriptions (id) on delete cascade,
  period_id           uuid not null references public.subscription_periods (id) on delete cascade,
  product_id          uuid references public.products (id) on delete set null,
  product_name        text not null default '',
  fulfilled_on        date not null,
  is_authorized_extra boolean not null default false,
  -- A repeated click or resubmitted form carries the same key and is ignored.
  idempotency_key     uuid not null unique,
  voided_at           timestamptz,
  void_reason         text,
  recorded_by         uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now()
);

create index fulfillments_by_period on public.fulfillments (period_id);

-- ============================================================ contact

create table public.contact_messages (
  id                  uuid primary key default gen_random_uuid(),
  status              text not null default 'new' check (status in ('new', 'resolved')),
  name                text not null,
  email               text not null,
  message             text not null,
  idempotency_key     uuid not null unique,
  notification_status text not null default 'pending'
                        check (notification_status in ('pending', 'sent', 'failed', 'not-configured')),
  notification_error  text,
  resolved_at         timestamptz,
  created_at          timestamptz not null default now()
);

create index messages_by_status on public.contact_messages (status, created_at desc);

-- Counts recent form submissions per visitor (a salted hash, not an IP).
create table public.rate_limit_hits (
  bucket     text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_hits_lookup on public.rate_limit_hits (bucket, created_at);

-- ============================================================ row-level security

alter table public.admins                 enable row level security;
alter table public.settings               enable row level security;
alter table public.pickup_closures        enable row level security;
alter table public.products               enable row level security;
alter table public.orders                 enable row level security;
alter table public.order_items            enable row level security;
alter table public.subscription_plans     enable row level security;
alter table public.subscription_inquiries enable row level security;
alter table public.subscriptions          enable row level security;
alter table public.subscription_periods   enable row level security;
alter table public.fulfillments           enable row level security;
alter table public.contact_messages       enable row level security;
alter table public.rate_limit_hits        enable row level security;

-- Start from nothing, then grant exactly what each role needs.
revoke all on all tables in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;

grant select on public.products, public.settings, public.pickup_closures, public.subscription_plans
  to anon, authenticated;

grant select on public.admins to authenticated;
grant select, insert, update, delete on
  public.products, public.settings, public.pickup_closures, public.subscription_plans,
  public.orders, public.order_items, public.subscription_inquiries, public.subscriptions,
  public.subscription_periods, public.fulfillments, public.contact_messages
  to authenticated;

-- What visitors can read.
create policy "Visitors read products that aren't archived" on public.products
  for select to anon, authenticated
  using (archived_at is null or (select public.is_admin()));

create policy "Visitors read public settings" on public.settings
  for select to anon, authenticated
  using (is_public or (select public.is_admin()));

create policy "Visitors read pickup closures" on public.pickup_closures
  for select to anon, authenticated
  using (true);

create policy "Visitors read enabled plans" on public.subscription_plans
  for select to anon, authenticated
  using (enabled or (select public.is_admin()));

-- A signed-in user can see whether they themselves are an administrator.
-- Nobody can add or remove administrators through the API.
create policy "Users read their own admin row" on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Administrators manage everything else. Each table gets write policies
-- for administrators only; the private tables get no visitor policy at
-- all, so visitors can neither read nor write them.
create policy "Admins insert products" on public.products for insert to authenticated with check ((select public.is_admin()));
create policy "Admins update products" on public.products for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete products" on public.products for delete to authenticated using ((select public.is_admin()));

create policy "Admins insert settings" on public.settings for insert to authenticated with check ((select public.is_admin()));
create policy "Admins update settings" on public.settings for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete settings" on public.settings for delete to authenticated using ((select public.is_admin()));

create policy "Admins insert closures" on public.pickup_closures for insert to authenticated with check ((select public.is_admin()));
create policy "Admins delete closures" on public.pickup_closures for delete to authenticated using ((select public.is_admin()));

create policy "Admins insert plans" on public.subscription_plans for insert to authenticated with check ((select public.is_admin()));
create policy "Admins update plans" on public.subscription_plans for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admins manage orders" on public.orders for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins manage order items" on public.order_items for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins manage inquiries" on public.subscription_inquiries for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins manage subscriptions" on public.subscriptions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins manage periods" on public.subscription_periods for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins manage fulfillments" on public.fulfillments for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins manage messages" on public.contact_messages for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ============================================================ functions: public forms

-- OL-7K3F9Q style reference. Not a secret; just easy to read over the phone.
create function public.new_reference(p_prefix text) returns text
language sql volatile set search_path = ''
as $$
  select p_prefix || '-' || string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 6);
$$;

-- Saves a one-time order request and its items in one transaction.
-- Re-checks every loaf against the catalog at the moment of saving.
create function public.submit_order(p jsonb) returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_key   uuid := (p ->> 'idempotency_key')::uuid;
  v_order public.orders;
  v_item  jsonb;
  v_prod  public.products;
  v_qty   integer;
begin
  select * into v_order from public.orders where idempotency_key = v_key;
  if found then
    return jsonb_build_object('id', v_order.id, 'reference', v_order.reference, 'duplicate', true);
  end if;

  if jsonb_array_length(coalesce(p -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'no_items';
  end if;

  insert into public.orders (reference, customer_name, customer_email, customer_phone, pickup_date, notes, idempotency_key)
  values (public.new_reference('OL'), p ->> 'name', p ->> 'email', coalesce(p ->> 'phone', ''),
          (p ->> 'pickup_date')::date, coalesce(p ->> 'notes', ''), v_key)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p -> 'items') loop
    v_qty := (v_item ->> 'quantity')::integer;
    select * into v_prod from public.products
      where id = (v_item ->> 'product_id')::uuid and archived_at is null;
    if not found or v_prod.availability not in ('available', 'limited') then
      raise exception 'product_unavailable';
    end if;
    insert into public.order_items (order_id, product_id, product_name, unit_price_cents, quantity)
    values (v_order.id, v_prod.id, v_prod.name, v_prod.price_cents, v_qty);
  end loop;

  return jsonb_build_object('id', v_order.id, 'reference', v_order.reference, 'duplicate', false);
exception
  when unique_violation then
    -- Two identical submissions raced; hand back the one that won.
    select * into v_order from public.orders where idempotency_key = v_key;
    if found then
      return jsonb_build_object('id', v_order.id, 'reference', v_order.reference, 'duplicate', true);
    end if;
    raise;
end;
$$;

-- Saves a Club enrollment request. This is an inquiry only.
create function public.submit_inquiry(p jsonb) returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_key  uuid := (p ->> 'idempotency_key')::uuid;
  v_row  public.subscription_inquiries;
  v_plan public.subscription_plans;
begin
  select * into v_row from public.subscription_inquiries where idempotency_key = v_key;
  if found then
    return jsonb_build_object('id', v_row.id, 'reference', v_row.reference, 'duplicate', true);
  end if;

  select * into v_plan from public.subscription_plans where id = (p ->> 'plan_id')::uuid;
  if not found or not v_plan.enabled or not v_plan.accepting_requests then
    raise exception 'enrollment_closed';
  end if;

  insert into public.subscription_inquiries
    (reference, plan_id, name, email, phone, preferred_pickup_day, preferred_first_pickup_date,
     requested_loaves, bread_preferences, additional_requests, acknowledged_terms_at, idempotency_key)
  values
    (public.new_reference('CL'), v_plan.id, p ->> 'name', p ->> 'email', coalesce(p ->> 'phone', ''),
     coalesce(p ->> 'pickup_day', 'flexible'), (p ->> 'first_pickup_date')::date,
     coalesce(p -> 'requested_loaves', '[]'::jsonb), coalesce(p ->> 'bread_preferences', ''),
     coalesce(p ->> 'requests', ''), now(), v_key)
  returning * into v_row;

  return jsonb_build_object('id', v_row.id, 'reference', v_row.reference, 'duplicate', false);
exception
  when unique_violation then
    select * into v_row from public.subscription_inquiries where idempotency_key = v_key;
    if found then
      return jsonb_build_object('id', v_row.id, 'reference', v_row.reference, 'duplicate', true);
    end if;
    raise;
end;
$$;

create function public.submit_contact(p jsonb) returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_key uuid := (p ->> 'idempotency_key')::uuid;
  v_id  uuid;
begin
  insert into public.contact_messages (name, email, message, idempotency_key)
  values (p ->> 'name', p ->> 'email', p ->> 'message', v_key)
  on conflict (idempotency_key) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.contact_messages where idempotency_key = v_key;
    return jsonb_build_object('id', v_id, 'duplicate', true);
  end if;
  return jsonb_build_object('id', v_id, 'duplicate', false);
end;
$$;

-- Records whether the owner's email notification went out.
create function public.set_notification(p_kind text, p_id uuid, p_status text, p_error text default null)
returns void
language plpgsql set search_path = ''
as $$
begin
  if p_kind = 'order' then
    update public.orders set notification_status = p_status, notification_error = p_error where id = p_id;
  elsif p_kind = 'inquiry' then
    update public.subscription_inquiries set notification_status = p_status, notification_error = p_error where id = p_id;
  elsif p_kind = 'contact' then
    update public.contact_messages set notification_status = p_status, notification_error = p_error where id = p_id;
  else
    raise exception 'unknown_kind';
  end if;
end;
$$;

-- Returns true when this visitor is still within the limit, and counts the hit.
create function public.check_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.rate_limit_hits where created_at < now() - interval '1 day';
  select count(*) into v_count from public.rate_limit_hits
    where bucket = p_bucket and created_at > now() - make_interval(secs => p_window_seconds);
  if v_count >= p_limit then
    return false;
  end if;
  insert into public.rate_limit_hits (bucket) values (p_bucket);
  return true;
end;
$$;

-- ============================================================ functions: owner actions

-- Turns an inquiry into a subscription. Only an administrator can call
-- it, only once per inquiry, and never past the plan's subscriber limit.
-- It records no payment and creates no allowance period.
create function public.approve_inquiry(p_inquiry_id uuid, p_started_on date, p_pickup_day text default null)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_inq  public.subscription_inquiries;
  v_plan public.subscription_plans;
  v_count integer;
  v_id   uuid;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  select * into v_inq from public.subscription_inquiries where id = p_inquiry_id for update;
  if not found then
    raise exception 'inquiry_not_found';
  end if;
  if v_inq.status not in ('inquiry', 'pending-approval') then
    raise exception 'inquiry_already_decided';
  end if;

  select * into v_plan from public.subscription_plans where id = v_inq.plan_id for update;
  if v_plan.max_subscribers is not null then
    select count(*) into v_count from public.subscriptions
      where plan_id = v_plan.id and status in ('active', 'paused');
    if v_count >= v_plan.max_subscribers then
      raise exception 'subscriber_limit_reached';
    end if;
  end if;

  insert into public.subscriptions
    (inquiry_id, plan_id, subscriber_name, subscriber_email, subscriber_phone,
     price_cents, currency, loaves_per_period, pickup_day, started_on)
  values
    (v_inq.id, v_plan.id, v_inq.name, v_inq.email, v_inq.phone,
     v_plan.price_cents, v_plan.currency, v_plan.loaves_per_period,
     coalesce(nullif(p_pickup_day, ''), v_inq.preferred_pickup_day), p_started_on)
  returning id into v_id;

  update public.subscription_inquiries
    set status = 'approved', subscription_id = v_id where id = v_inq.id;
  return v_id;
end;
$$;

-- Returns the allowance period with these dates, creating it if needed.
-- Refuses for memberships that are paused, canceled, or not yet started,
-- so an allowance is never granted to an inactive membership.
create function public.ensure_period(p_subscription_id uuid, p_starts_on date, p_ends_on date)
returns public.subscription_periods
language plpgsql set search_path = ''
as $$
declare
  v_sub    public.subscriptions;
  v_period public.subscription_periods;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  select * into v_period from public.subscription_periods
    where subscription_id = p_subscription_id and starts_on = p_starts_on;
  if found then
    return v_period;
  end if;

  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then
    raise exception 'subscription_not_found';
  end if;
  if v_sub.status <> 'active' or p_ends_on < v_sub.started_on then
    raise exception 'subscription_not_active';
  end if;

  insert into public.subscription_periods (subscription_id, starts_on, ends_on, allowance)
  values (p_subscription_id, p_starts_on, p_ends_on, v_sub.loaves_per_period)
  on conflict (subscription_id, starts_on) do nothing;

  select * into v_period from public.subscription_periods
    where subscription_id = p_subscription_id and starts_on = p_starts_on;
  return v_period;
end;
$$;

-- Records one loaf handed over. Safe against double clicks (same key is
-- ignored) and against two people recording at once (the period row is
-- locked while counting).
create function public.fulfill_loaf(
  p_period_id uuid, p_product_id uuid, p_fulfilled_on date,
  p_idempotency_key uuid, p_as_extra boolean default false
) returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_existing public.fulfillments;
  v_period   public.subscription_periods;
  v_sub      public.subscriptions;
  v_used     integer;
  v_extra    boolean := false;
  v_name     text := '';
  v_id       uuid;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  select * into v_existing from public.fulfillments where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'duplicate', true, 'is_extra', v_existing.is_authorized_extra);
  end if;

  select * into v_period from public.subscription_periods where id = p_period_id for update;
  if not found then
    raise exception 'period_not_found';
  end if;
  select * into v_sub from public.subscriptions where id = v_period.subscription_id;
  if v_sub.status <> 'active' then
    raise exception 'subscription_not_active';
  end if;
  if p_fulfilled_on < v_period.starts_on or p_fulfilled_on > v_period.ends_on then
    raise exception 'date_outside_period';
  end if;

  select count(*) into v_used from public.fulfillments
    where period_id = v_period.id and voided_at is null;

  if v_used >= v_period.allowance + v_period.authorized_extra_loaves then
    if not p_as_extra then
      raise exception 'allowance_exhausted';
    end if;
    -- The owner is explicitly recording an additional purchase.
    update public.subscription_periods
      set authorized_extra_loaves = authorized_extra_loaves + 1 where id = v_period.id;
    v_extra := true;
  elsif v_used >= v_period.allowance then
    v_extra := true;
  end if;

  if p_product_id is not null then
    select name into v_name from public.products where id = p_product_id;
  end if;

  insert into public.fulfillments
    (subscription_id, period_id, product_id, product_name, fulfilled_on, is_authorized_extra,
     idempotency_key, recorded_by)
  values
    (v_sub.id, v_period.id, p_product_id, coalesce(v_name, ''), p_fulfilled_on, v_extra,
     p_idempotency_key, (select auth.uid()))
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'duplicate', false, 'is_extra', v_extra);
exception
  when unique_violation then
    select * into v_existing from public.fulfillments where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('id', v_existing.id, 'duplicate', true, 'is_extra', v_existing.is_authorized_extra);
    end if;
    raise;
end;
$$;

-- Last line of defence: even a direct insert can't exceed the allowance
-- or land on an inactive membership.
create function public.guard_fulfillment() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_period public.subscription_periods;
  v_status text;
  v_used   integer;
begin
  select * into v_period from public.subscription_periods where id = new.period_id for update;
  select status into v_status from public.subscriptions where id = v_period.subscription_id;
  if v_status is distinct from 'active' then
    raise exception 'subscription_not_active';
  end if;
  if new.subscription_id <> v_period.subscription_id then
    raise exception 'period_mismatch';
  end if;
  select count(*) into v_used from public.fulfillments
    where period_id = new.period_id and voided_at is null;
  if v_used >= v_period.allowance + v_period.authorized_extra_loaves then
    raise exception 'allowance_exhausted';
  end if;
  return new;
end;
$$;

create trigger fulfillment_guard before insert on public.fulfillments
  for each row execute function public.guard_fulfillment();

-- Fulfillment records are permanent: block deletes, and allow updates
-- only to void a record.
create function public.protect_fulfillment() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'fulfillments_are_permanent';
  end if;
  if new.period_id <> old.period_id or new.subscription_id <> old.subscription_id
     or new.fulfilled_on <> old.fulfilled_on or new.idempotency_key <> old.idempotency_key
     or new.is_authorized_extra <> old.is_authorized_extra then
    raise exception 'fulfillments_are_permanent';
  end if;
  return new;
end;
$$;

create trigger fulfillment_protect before update or delete on public.fulfillments
  for each row execute function public.protect_fulfillment();

-- ============================================================ who may run what

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_admin() to anon, authenticated, service_role;

grant execute on function
  public.submit_order(jsonb), public.submit_inquiry(jsonb), public.submit_contact(jsonb),
  public.set_notification(text, uuid, text, text), public.check_rate_limit(text, integer, integer),
  public.new_reference(text)
  to service_role;

grant execute on function
  public.approve_inquiry(uuid, date, text), public.ensure_period(uuid, date, date),
  public.fulfill_loaf(uuid, uuid, date, uuid, boolean), public.new_reference(text)
  to authenticated;
