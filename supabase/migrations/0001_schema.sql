-- DetailDesk V1 — full schema, RLS, indexes.
-- Run in Supabase SQL editor or via `supabase db push`.

-- ═══════════════ EXTENSIONS ═══════════════
create extension if not exists "pgcrypto";

-- ═══════════════ ENUMS ═══════════════
create type public.business_type as enum ('studio', 'mobile', 'both');
create type public.member_role as enum ('owner', 'staff');
create type public.service_category as enum ('interior', 'exterior', 'polish', 'ceramic', 'restoration', 'other');
create type public.deposit_type as enum ('fixed', 'percent');
create type public.booking_status as enum ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'cancelled', 'refunded');
create type public.email_type as enum ('welcome', 'booking_confirmation', 'payment_confirmation', 'booking_reminder', 'booking_cancelled');

-- ═══════════════ TABLES ═══════════════

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  platform_role text check (platform_role in ('platform_admin')),
  created_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  email text not null,
  phone text,
  address text,
  business_type public.business_type not null default 'studio',
  logo_url text,
  cancellation_policy text,
  stripe_account_id text,
  stripe_connected boolean not null default false,
  is_active boolean not null default true,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'owner',
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  category public.service_category not null default 'other',
  price_cents integer not null check (price_cents >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  deposit_required boolean not null default false,
  deposit_type public.deposit_type not null default 'fixed',
  deposit_value integer not null default 0 check (deposit_value >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  make text not null,
  model text not null,
  year integer,
  plate text,
  size_category text check (size_category in ('compact', 'sedan', 'suv', 'truck', 'van', 'other')),
  notes text,
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid not null references public.services(id),
  customer_id uuid not null references public.customers(id),
  vehicle_id uuid references public.vehicles(id),
  status public.booking_status not null default 'pending',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  total_price_cents integer not null check (total_price_cents >= 0),
  deposit_amount_cents integer not null default 0 check (deposit_amount_cents >= 0),
  deposit_paid boolean not null default false,
  public_cancel_token uuid unique default gen_random_uuid(),
  notes text,
  created_at timestamptz not null default now()
);

create table public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  old_status public.booking_status,
  new_status public.booking_status not null,
  changed_by_profile_id uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text unique,
  stripe_connected_account_id text,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'eur',
  status public.payment_status not null default 'pending',
  provider text not null default 'stripe',
  -- reserved for V2 platform commission
  application_fee_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  check (start_time < end_time)
);

create table public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  check (starts_at < ends_at)
);

create table public.business_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  timezone text not null default 'Europe/Paris',
  reminder_hours_before integer not null default 24,
  booking_notice_hours integer not null default 12,
  buffer_minutes integer not null default 15,
  confirmation_message text,
  reminder_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  resend_id text,
  type public.email_type not null,
  recipient text not null,
  status text not null default 'sent',
  created_at timestamptz not null default now()
);

-- booking reminder tracking (avoid double-sends)
create table public.booking_reminders (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  sent_at timestamptz not null default now()
);

-- ═══════════════ INDEXES ═══════════════
create index idx_business_members_user on public.business_members(user_id);
create index idx_business_members_business on public.business_members(business_id);
create index idx_services_business on public.services(business_id);
create index idx_customers_business on public.customers(business_id);
create index idx_vehicles_business on public.vehicles(business_id);
create index idx_vehicles_customer on public.vehicles(customer_id);
create index idx_bookings_business on public.bookings(business_id);
create index idx_bookings_business_starts on public.bookings(business_id, starts_at);
create index idx_bookings_status on public.bookings(business_id, status);
create index idx_bsh_business on public.booking_status_history(business_id, booking_id);
create index idx_payments_business on public.payments(business_id);
create index idx_payments_booking on public.payments(booking_id);
create index idx_availability_business on public.availability_rules(business_id);
create index idx_blocked_business on public.blocked_slots(business_id);
create index idx_email_logs_business on public.email_logs(business_id);

-- ═══════════════ HELPER FUNCTIONS ═══════════════

-- Is the current user a member of this business?
create or replace function public.is_business_member(b_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = b_id and user_id = auth.uid()
  );
$$;

-- Is the current user a platform admin?
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and platform_role = 'platform_admin'
  );
$$;

-- ═══════════════ RLS ═══════════════
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.services enable row level security;
alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.payments enable row level security;
alter table public.availability_rules enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.business_settings enable row level security;
alter table public.email_logs enable row level security;
alter table public.booking_reminders enable row level security;

-- profiles: user sees/updates own profile; platform admin sees all
create policy "profiles_select_own" on public.profiles for select
  using (id = auth.uid() or public.is_platform_admin());
create policy "profiles_insert_own" on public.profiles for insert
  with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid());

-- businesses: members read/update; any authed user can create; admin reads all
create policy "businesses_select_member" on public.businesses for select
  using (public.is_business_member(id) or public.is_platform_admin());
create policy "businesses_insert_authed" on public.businesses for insert
  with check (auth.uid() is not null);
create policy "businesses_update_member" on public.businesses for update
  using (public.is_business_member(id));

-- business_members: members see their business memberships; user can insert self as owner of a business with no members yet (onboarding)
create policy "members_select" on public.business_members for select
  using (user_id = auth.uid() or public.is_business_member(business_id) or public.is_platform_admin());
create policy "members_insert_self_owner" on public.business_members for insert
  with check (
    user_id = auth.uid() and role = 'owner'
    and not exists (select 1 from public.business_members m where m.business_id = business_id)
  );

-- Generic tenant policies: member full access + admin read
create policy "services_member_all" on public.services for all
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy "services_admin_read" on public.services for select using (public.is_platform_admin());

create policy "customers_member_all" on public.customers for all
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy "customers_admin_read" on public.customers for select using (public.is_platform_admin());

create policy "vehicles_member_all" on public.vehicles for all
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy "vehicles_admin_read" on public.vehicles for select using (public.is_platform_admin());

create policy "bookings_member_all" on public.bookings for all
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy "bookings_admin_read" on public.bookings for select using (public.is_platform_admin());

create policy "bsh_member_all" on public.booking_status_history for all
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy "bsh_admin_read" on public.booking_status_history for select using (public.is_platform_admin());

create policy "payments_member_read" on public.payments for select
  using (public.is_business_member(business_id) or public.is_platform_admin());
-- payments are written only by the server (service role bypasses RLS)

create policy "availability_member_all" on public.availability_rules for all
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create policy "blocked_member_all" on public.blocked_slots for all
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create policy "settings_member_all" on public.business_settings for all
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create policy "email_logs_member_read" on public.email_logs for select
  using (public.is_business_member(business_id) or public.is_platform_admin());
-- email_logs written only by server (service role)

create policy "reminders_none" on public.booking_reminders for select using (public.is_platform_admin());
-- booking_reminders written only by server (service role)

-- NOTE: the public booking page (/b/[slug]) reads business/services and creates
-- bookings through SERVER code using the service-role client with explicit,
-- narrow queries. No anon RLS access is granted to tenant data.

-- ═══════════════ TRIGGERS ═══════════════

-- Auto-create profile on signup + auto-grant platform_admin from allowlist (set via app, not here)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Log booking status changes
create or replace function public.log_booking_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.booking_status_history (business_id, booking_id, old_status, new_status, changed_by_profile_id)
    values (new.business_id, new.id, old.status, new.status, auth.uid());
  elsif tg_op = 'INSERT' then
    insert into public.booking_status_history (business_id, booking_id, old_status, new_status, changed_by_profile_id)
    values (new.business_id, new.id, null, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger on_booking_status_change
  after insert or update on public.bookings
  for each row execute function public.log_booking_status();

-- updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger businesses_touch before update on public.businesses
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.business_settings
  for each row execute function public.touch_updated_at();
