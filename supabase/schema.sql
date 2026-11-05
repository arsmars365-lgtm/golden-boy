-- Foundly schema and security. Safe to run on a project with the previous
-- Foundly items/item_reports schema; existing announcements are migrated.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique
    check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  full_name text not null default '',
  avatar_url text,
  bio text not null default '',
  faculty text not null default '',
  course smallint check (course between 1 and 8),
  contact_telegram text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  is_verified boolean not null default false,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now()
);

do $$
declare
  constraint_name text;
begin
  if to_regclass('public.items') is null then
    create table public.items (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      type text not null check (type in ('lost', 'found')),
      title text not null check (char_length(title) between 1 and 80),
      description text not null default '',
      category text not null,
      location text not null,
      date date not null,
      photos text[] not null default '{}',
      price numeric(12,2),
      status text not null default 'active'
        check (status in ('active', 'returned', 'hidden')),
      contact_method text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  else
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='items' and column_name='owner_id')
       and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='items' and column_name='user_id') then
      alter table public.items rename column owner_id to user_id;
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='items' and column_name='place')
       and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='items' and column_name='location') then
      alter table public.items rename column place to location;
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='items' and column_name='details')
       and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='items' and column_name='description') then
      alter table public.items rename column details to description;
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='items' and column_name='telegram')
       and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='items' and column_name='contact_method') then
      alter table public.items rename column telegram to contact_method;
    end if;
    alter table public.items add column if not exists photos text[] not null default '{}';
    alter table public.items add column if not exists price numeric(12,2);
    alter table public.items add column if not exists updated_at timestamptz not null default now();
    alter table public.items alter column description set default '';
    alter table public.items add column if not exists contact_method text not null default '';
    alter table public.items alter column contact_method set default '';

    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='items' and column_name='image_data_url') then
      execute $sql$update public.items set photos = array[image_data_url] where image_data_url is not null and image_data_url <> ''$sql$;
      alter table public.items drop column image_data_url;
    end if;

    -- Older versions used "searching"/"found" in addition to "returned".
    for constraint_name in
      select c.conname from pg_constraint c
      where c.conrelid = 'public.items'::regclass and c.contype = 'c'
        and pg_get_constraintdef(c.oid) ilike '%status%'
    loop
      execute format('alter table public.items drop constraint %I', constraint_name);
    end loop;
    update public.items set status = case when status = 'returned' then 'returned' else 'active' end;
    update public.items set date = created_at::date where date is null;
    alter table public.items alter column date set not null;
    alter table public.items add constraint items_status_check
      check (status in ('active', 'returned', 'hidden'));
    alter table public.items drop column if exists time;
    alter table public.items drop column if exists art;
    alter table public.items drop column if exists symbol;
  end if;
end
$$;

create index if not exists items_created_at_idx on public.items (created_at desc);
create index if not exists items_user_id_idx on public.items (user_id);
create index if not exists items_status_idx on public.items (status);

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.items'::regclass and conname='items_description_length_check') then
    alter table public.items add constraint items_description_length_check
      check (char_length(description) <= 1500);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.items'::regclass and conname='items_location_length_check') then
    alter table public.items add constraint items_location_length_check
      check (char_length(location) between 1 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.items'::regclass and conname='items_photos_count_check') then
    alter table public.items add constraint items_photos_count_check
      check (cardinality(photos) <= 3);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.items'::regclass and conname='items_price_nonnegative_check') then
    alter table public.items add constraint items_price_nonnegative_check
      check (price is null or price >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.items'::regclass and conname='items_category_check') then
    alter table public.items add constraint items_category_check
      check (category in ('Документы','Телефон','Ключи','Наушники','Одежда','Сумки','Другое','Электроника','Книги'));
  end if;
end
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and not is_blocked
  );
$$;

create unique index if not exists profiles_username_ci_idx
  on public.profiles (lower(username));

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role
      or new.is_verified is distinct from old.is_verified
      or new.is_blocked is distinct from old.is_blocked)
     and not public.is_admin()
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'Only administrators can change roles, verification, or block status'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileged_fields on public.profiles;
create trigger protect_profile_privileged_fields
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_fields();

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and not is_blocked
  );
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_active_user() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to anon;
grant execute on function public.is_active_user() to authenticated;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
  chosen_username text;
  suffix text;
begin
  base_username := lower(regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'user'),
    '[^A-Za-z0-9_]', '', 'g'
  ));
  base_username := left(base_username, 14);
  if char_length(base_username) < 3 then
    base_username := 'user';
  end if;
  chosen_username := base_username;
  if exists (select 1 from public.profiles p where lower(p.username) = lower(chosen_username)) then
    suffix := substr(replace(new.id::text, '-', ''), 1, 6);
    chosen_username := left(base_username, 13) || '_' || suffix;
  end if;

  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    chosen_username,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

insert into public.profiles (id, username, full_name)
select
  users.id,
  left(coalesce(nullif(regexp_replace(lower(split_part(users.email, '@', 1)), '[^a-z0-9_]', '', 'g'), ''), 'user'), 13)
    || '_' || substr(replace(users.id::text, '-', ''), 1, 6),
  coalesce(users.raw_user_meta_data ->> 'full_name', users.raw_user_meta_data ->> 'name', '')
from auth.users users
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.items'::regclass
      and conname = 'items_user_profile_fkey'
  ) then
    alter table public.items
      add constraint items_user_profile_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end
$$;

create or replace function public.touch_item_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists touch_item_updated_at on public.items;
create trigger touch_item_updated_at
  before update on public.items
  for each row execute function public.touch_item_updated_at();

create or replace function public.limit_user_item_posts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_posts integer;
begin
  if public.is_admin() then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext(new.user_id::text));
  select count(*) into recent_posts
  from public.items
  where user_id = new.user_id and created_at > now() - interval '1 hour';
  if recent_posts >= 10 then
    raise exception 'Listing limit reached. Try again later.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists limit_user_item_posts on public.items;
create trigger limit_user_item_posts
  before insert on public.items
  for each row execute function public.limit_user_item_posts();

-- Migrate the former reports table, preserving its records.
do $$
begin
  if to_regclass('public.item_reports') is not null
     and to_regclass('public.reports') is null then
    alter table public.item_reports rename to reports;
  end if;
end
$$;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);
alter table public.reports add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.reports add column if not exists status text not null default 'open';
-- Policies on a legacy reports table can depend on reason and block its type change.
do $$
declare policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename = 'reports'
  loop
    execute format('drop policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end
$$;
alter table public.reports alter column reason type text;
alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports add constraint reports_status_check
  check (status in ('open', 'reviewed', 'dismissed'));
create index if not exists reports_created_at_idx on public.reports (created_at desc);

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.reports enable row level security;

-- Remove earlier policies so no permissive policy can override this policy set.
do $$
declare policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('profiles', 'items', 'reports')
  loop
    execute format('drop policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end
$$;

create policy "Profiles are publicly readable"
  on public.profiles for select to anon, authenticated using (true);
create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) and public.is_active_user())
  with check (id = (select auth.uid()) and public.is_active_user());
create policy "Admins manage profiles"
  on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Column grants prevent users from changing privileged fields; admin policy
-- permits those same columns for admins only.
revoke update on public.profiles from anon, authenticated;
revoke update (contact_telegram) on public.profiles from anon, authenticated;
grant update (username, full_name, avatar_url, bio, faculty, course)
  on public.profiles to authenticated;
grant update (role, is_verified, is_blocked)
  on public.profiles to authenticated;
revoke select on public.profiles from anon, authenticated;
revoke select (contact_telegram) on public.profiles from anon, authenticated;
grant select (id, username, full_name, avatar_url, bio, faculty, course, role, is_verified, is_blocked, created_at)
  on public.profiles to anon, authenticated;

create policy "Public can read visible items"
  on public.items for select to anon, authenticated
  using (status <> 'hidden' or user_id = (select auth.uid()) or public.is_admin());
create policy "Active users create their own items"
  on public.items for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_user());
create policy "Owners or admins update items"
  on public.items for update to authenticated
  using ((user_id = (select auth.uid()) and public.is_active_user()) or public.is_admin())
  with check ((user_id = (select auth.uid()) and public.is_active_user()) or public.is_admin());
create policy "Owners or admins delete items"
  on public.items for delete to authenticated
  using ((user_id = (select auth.uid()) and public.is_active_user()) or public.is_admin());

create policy "Active users submit reports"
  on public.reports for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_user());
create policy "Admins read reports"
  on public.reports for select to authenticated using (public.is_admin());
create policy "Admins update reports"
  on public.reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete reports"
  on public.reports for delete to authenticated using (public.is_admin());

-- Data API privileges are explicit; RLS remains the row-level boundary.
revoke select on public.items from anon, authenticated;
revoke select (contact_method) on public.items from anon, authenticated;
grant select (id, user_id, type, title, description, category, location, date, photos, price, status, created_at, updated_at)
  on public.items to anon, authenticated;
revoke insert, update on public.items from authenticated;
revoke insert (contact_method), update (contact_method) on public.items from authenticated;
grant insert (id, user_id, type, title, description, category, location, date, photos, price, status)
  on public.items to authenticated;
grant update (title, description, category, location, date, photos, price, status)
  on public.items to authenticated;
grant delete on public.items to authenticated;
grant insert on public.reports to authenticated;
grant select, update, delete on public.reports to authenticated;

-- Storage paths are <auth.uid()>/<filename>. Public reads use public buckets;
-- writes/deletes are restricted to the owning user's folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('item-photos', 'item-photos', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view Foundly images" on storage.objects;
create policy "Public can view Foundly images"
  on storage.objects for select to anon, authenticated
  using (bucket_id in ('avatars', 'item-photos'));
drop policy if exists "Users upload their own Foundly images" on storage.objects;
create policy "Users upload their own Foundly images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('avatars', 'item-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active_user()
  );
drop policy if exists "Users update their own Foundly images" on storage.objects;
create policy "Users update their own Foundly images"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('avatars', 'item-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('avatars', 'item-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active_user()
  );
drop policy if exists "Users delete their own Foundly images" on storage.objects;
create policy "Users delete their own Foundly images"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('avatars', 'item-photos')
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
  );

do $$
begin
  alter publication supabase_realtime add table public.items;
exception when duplicate_object then null;
end
$$;
