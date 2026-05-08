-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  location text,
  crop_types text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, location, crop_types)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'location', ''),
    coalesce((select array_agg(value::text) from jsonb_array_elements_text(new.raw_user_meta_data->'crop_types') as value), '{}')
  );
  return new;
end;
$$;
create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

-- Diagnoses
create table public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_url text,
  prediction text,
  confidence numeric,
  recommendation text,
  raw jsonb,
  created_at timestamptz not null default now()
);
alter table public.diagnoses enable row level security;
create policy "diagnoses_select_own" on public.diagnoses for select using (auth.uid() = user_id);
create policy "diagnoses_insert_own" on public.diagnoses for insert with check (auth.uid() = user_id);
create policy "diagnoses_delete_own" on public.diagnoses for delete using (auth.uid() = user_id);
create index diagnoses_user_created_idx on public.diagnoses(user_id, created_at desc);

-- Chats
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);
alter table public.chats enable row level security;
create policy "chats_select_own" on public.chats for select using (auth.uid() = user_id);
create policy "chats_insert_own" on public.chats for insert with check (auth.uid() = user_id);
create policy "chats_delete_own" on public.chats for delete using (auth.uid() = user_id);
create index chats_user_created_idx on public.chats(user_id, created_at desc);

-- Crops (public read)
create table public.crops (
  id uuid primary key default gen_random_uuid(),
  crop_name text not null,
  season text,
  notes text,
  common_diseases text,
  created_at timestamptz not null default now()
);
alter table public.crops enable row level security;
create policy "crops_public_read" on public.crops for select using (true);

insert into public.crops (crop_name, season, notes, common_diseases) values
('Tomato','Warm season (Spring–Summer)','Needs full sun, well-drained soil, regular watering. Stake or cage plants.','Early blight, Late blight, Fusarium wilt'),
('Maize','Summer','Plant after last frost. Heavy feeder; needs nitrogen-rich soil.','Maize lethal necrosis, Gray leaf spot, Rust'),
('Cassava','Year-round (tropical)','Drought tolerant; harvest 8–12 months after planting.','Cassava mosaic disease, Brown streak disease'),
('Beans','Cool to warm season','Fix nitrogen in soil. Avoid overhead watering.','Anthracnose, Bean rust, Bacterial blight'),
('Potato','Cool season','Hill soil around stems as plants grow.','Late blight, Early blight, Scab'),
('Rice','Wet season','Requires flooded paddies or consistent moisture.','Rice blast, Bacterial leaf blight, Sheath blight'),
('Sorghum','Warm dry season','Drought tolerant grain crop.','Anthracnose, Grain mold, Ergot'),
('Cabbage','Cool season','Heavy feeder, needs consistent moisture.','Black rot, Clubroot, Downy mildew'),
('Onion','Cool season','Long day vs short day varieties for latitude.','Downy mildew, Purple blotch, Botrytis'),
('Banana','Year-round (tropical)','Needs rich soil and steady rainfall.','Panama disease, Black sigatoka, Bunchy top virus');

-- Storage bucket for diagnosis images
insert into storage.buckets (id, name, public) values ('diagnosis-images','diagnosis-images', true)
on conflict (id) do nothing;

create policy "diagnosis_images_public_read" on storage.objects for select
using (bucket_id = 'diagnosis-images');
create policy "diagnosis_images_user_upload" on storage.objects for insert
with check (bucket_id = 'diagnosis-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "diagnosis_images_user_delete" on storage.objects for delete
using (bucket_id = 'diagnosis-images' and auth.uid()::text = (storage.foldername(name))[1]);