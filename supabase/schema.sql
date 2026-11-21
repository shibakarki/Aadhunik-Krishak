-- ==========================================
-- Aadhunik Krishak - Supabase Schema
-- ==========================================

-- 1. Farmer Profiles (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  district text,
  preferred_language text not null default 'en',
  created_at timestamptz not null default now()
);

-- Automatically create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone, district)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'district'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Farms
create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  district text,
  latitude double precision not null,
  longitude double precision not null,
  area_hectares double precision not null default 0.5,
  elevation_m double precision,
  agro_zone text check (agro_zone in ('Terai', 'Hill', 'Mountain')),
  soil_type text,
  soil_ph double precision,
  created_at timestamptz not null default now()
);

-- 3. Registered Crops
create table if not exists public.crops (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  crop_key text not null,
  crop_name text not null,
  variety text,
  sowing_date date not null,
  expected_harvest_date date not null,
  area_hectares double precision default 0.25,
  status text not null default 'active' check (status in ('active', 'harvested', 'cancelled')),
  created_at timestamptz not null default now()
);

-- 4. Farming Activities & Reminders
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  crop_id uuid not null references public.crops(id) on delete cascade,
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  activity_type text not null check (
    activity_type in ('sowing', 'irrigation', 'fertilizer', 'weeding', 'pest_check', 'harvest')
  ),
  due_date date not null,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 5. AI Plant Doctor Scan History
create table if not exists public.disease_scans (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid references public.farms(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  crop_name text,
  diagnosis text not null,
  severity text check (severity in ('low', 'medium', 'high', 'healthy')),
  confidence text,
  treatment text not null,
  preventive_measures text,
  created_at timestamptz not null default now()
);

-- ==========================================
-- Row Level Security (RLS)
-- ==========================================
alter table public.profiles enable row level security;
alter table public.farms enable row level security;
alter table public.crops enable row level security;
alter table public.activities enable row level security;
alter table public.disease_scans enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "Users can manage own farms" on public.farms;
create policy "Users can manage own farms" on public.farms
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own crops" on public.crops;
create policy "Users can manage own crops" on public.crops
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own activities" on public.activities;
create policy "Users can manage own activities" on public.activities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own disease scans" on public.disease_scans;
create policy "Users can manage own disease scans" on public.disease_scans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);