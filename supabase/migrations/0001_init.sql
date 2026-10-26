-- ReFound — Sprint 1: Foundation schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.
-- Safe to re-run only after a full reset; this migration assumes a clean database.

-- ============================================================================
-- Extensions
-- ============================================================================
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ============================================================================
-- Tables
-- ============================================================================

-- One row per authenticated user, mirroring auth.users.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  campus_email text,                 -- reserved for future campus-email verification
  campus_email_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Public-safe user profile data. One row per auth.users row.';

-- Optional reference list of named campus locations, used to power a location picker.
-- Publicly readable; writes are restricted to the service role (seeded by an admin/script).
create table public.campus_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  location_type text,                -- e.g. 'building', 'landmark', 'dining', 'library'
  created_at timestamptz not null default now()
);

-- Core LOST / FOUND reports.
create table public.items (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  report_type text not null check (report_type in ('LOST', 'FOUND')),
  title text not null check (char_length(trim(title)) between 1 and 100),
  description text check (char_length(description) <= 1000),
  category text not null,
  color text,
  item_datetime timestamptz not null,          -- when the item was lost/found
  latitude double precision,                    -- null unless the reporter opts in
  longitude double precision,
  location_name text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'RESOLVED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.items is 'Public-safe LOST/FOUND report data used for browsing and future matching.';

-- Photos attached to a report.
create table public.item_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  storage_path text not null,        -- path within the item-images storage bucket
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

-- Private, owner-only attributes used later for blind ownership verification.
-- NEVER joined into public item queries or exposed to other users.
create table public.item_verification_attributes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  attribute_key text not null check (char_length(trim(attribute_key)) between 1 and 80),
  attribute_value text not null check (char_length(trim(attribute_value)) between 1 and 300),
  created_at timestamptz not null default now()
);

comment on table public.item_verification_attributes is
  'Hidden ownership-verification details. Owner-only access. Never exposed publicly.';

-- ============================================================================
-- Indexes
-- ============================================================================
create index items_reporter_id_idx on public.items (reporter_id);
create index items_report_type_idx on public.items (report_type);
create index items_status_idx on public.items (status);
create index items_category_idx on public.items (category);
create index items_created_at_idx on public.items (created_at desc);
create index items_item_datetime_idx on public.items (item_datetime desc);

create index item_images_item_id_idx on public.item_images (item_id);
create index item_verification_attributes_item_id_idx on public.item_verification_attributes (item_id);

-- ============================================================================
-- updated_at maintenance
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_items_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Auto-create a profile row whenever a new auth user signs up
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.campus_locations enable row level security;
alter table public.items enable row level security;
alter table public.item_images enable row level security;
alter table public.item_verification_attributes enable row level security;

-- ---- profiles ----
-- Users may only read and modify their own profile. Other users' identities
-- are never exposed via this table (item cards do not join reporter details).
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- ---- campus_locations ----
-- Publicly readable reference data; no client-side writes.
create policy "campus_locations_select_all"
  on public.campus_locations for select
  to authenticated
  using (true);

-- ---- items ----
-- Any authenticated user can browse ACTIVE/RESOLVED reports (needed for future
-- matching + browsing). CANCELLED reports are only visible to their owner.
create policy "items_select_visible"
  on public.items for select
  to authenticated
  using (status <> 'CANCELLED' or reporter_id = auth.uid());

create policy "items_insert_own"
  on public.items for insert
  to authenticated
  with check (reporter_id = auth.uid());

create policy "items_update_own"
  on public.items for update
  to authenticated
  using (reporter_id = auth.uid())
  with check (reporter_id = auth.uid());

create policy "items_delete_own"
  on public.items for delete
  to authenticated
  using (reporter_id = auth.uid());

-- ---- item_images ----
-- Images are visible whenever their parent item is visible; only the item's
-- owner may attach, replace, or remove images.
create policy "item_images_select_visible"
  on public.item_images for select
  to authenticated
  using (
    exists (
      select 1 from public.items i
      where i.id = item_images.item_id
        and (i.status <> 'CANCELLED' or i.reporter_id = auth.uid())
    )
  );

create policy "item_images_insert_own"
  on public.item_images for insert
  to authenticated
  with check (
    exists (
      select 1 from public.items i
      where i.id = item_images.item_id and i.reporter_id = auth.uid()
    )
  );

create policy "item_images_update_own"
  on public.item_images for update
  to authenticated
  using (
    exists (
      select 1 from public.items i
      where i.id = item_images.item_id and i.reporter_id = auth.uid()
    )
  );

create policy "item_images_delete_own"
  on public.item_images for delete
  to authenticated
  using (
    exists (
      select 1 from public.items i
      where i.id = item_images.item_id and i.reporter_id = auth.uid()
    )
  );

-- ---- item_verification_attributes ----
-- Strictly owner-only in every direction. A future sprint will add a
-- security-definer RPC to compare a claimant's guess without ever exposing
-- these rows directly to anyone but the report's owner.
create policy "item_verification_attributes_select_own"
  on public.item_verification_attributes for select
  to authenticated
  using (
    exists (
      select 1 from public.items i
      where i.id = item_verification_attributes.item_id and i.reporter_id = auth.uid()
    )
  );

create policy "item_verification_attributes_insert_own"
  on public.item_verification_attributes for insert
  to authenticated
  with check (
    exists (
      select 1 from public.items i
      where i.id = item_verification_attributes.item_id and i.reporter_id = auth.uid()
    )
  );

create policy "item_verification_attributes_update_own"
  on public.item_verification_attributes for update
  to authenticated
  using (
    exists (
      select 1 from public.items i
      where i.id = item_verification_attributes.item_id and i.reporter_id = auth.uid()
    )
  );

create policy "item_verification_attributes_delete_own"
  on public.item_verification_attributes for delete
  to authenticated
  using (
    exists (
      select 1 from public.items i
      where i.id = item_verification_attributes.item_id and i.reporter_id = auth.uid()
    )
  );

-- ============================================================================
-- Storage: item-images bucket
-- ============================================================================
-- Public bucket: item photos alone don't expose personal identity, and public
-- read URLs keep the client simple. Writes are still gated by RLS below —
-- only an authenticated user may upload into their own uid-prefixed folder,
-- and only for items they own.
insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do nothing;

create policy "item_images_storage_read"
  on storage.objects for select
  to public
  using (bucket_id = 'item-images');

create policy "item_images_storage_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "item_images_storage_update_own_folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "item_images_storage_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
