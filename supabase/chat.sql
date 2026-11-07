-- Run after supabase/schema.sql to enable private, real-time direct messages.
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_1 uuid not null references public.profiles(id) on delete cascade,
  participant_2 uuid not null references public.profiles(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  last_message_preview text not null default ''
    check (char_length(last_message_preview) <= 240),
  participant_1_last_read_at timestamptz not null default now(),
  participant_2_last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_distinct_participants_check check (participant_1 < participant_2),
  constraint conversations_participants_unique unique (participant_1, participant_2)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000 and char_length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);

alter table public.conversations
  add column if not exists participant_1_last_read_at timestamptz not null default now(),
  add column if not exists participant_2_last_read_at timestamptz not null default now();
alter table public.items add column if not exists price numeric(12,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.items'::regclass
      and conname = 'items_price_nonnegative_check'
  ) then
    alter table public.items add constraint items_price_nonnegative_check
      check (price is null or price >= 0);
  end if;
end
$$;

create index if not exists conversations_participant_1_updated_at_idx
  on public.conversations (participant_1, updated_at desc);
create index if not exists conversations_participant_2_updated_at_idx
  on public.conversations (participant_2, updated_at desc);
create index if not exists messages_conversation_created_at_idx
  on public.messages (conversation_id, created_at);
create index if not exists messages_unread_by_conversation_idx
  on public.messages (conversation_id, sender_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Participants read conversations" on public.conversations;
create policy "Participants read conversations"
  on public.conversations for select to authenticated
  using (
    public.is_active_user()
    and (select auth.uid()) in (participant_1, participant_2)
    and exists (
      select 1
      from public.profiles other_profile
      where other_profile.id = case
        when participant_1 = (select auth.uid()) then participant_2
        else participant_1
      end
        and not other_profile.is_blocked
    )
  );

drop policy if exists "Participants read messages" on public.messages;
create policy "Participants read messages"
  on public.messages for select to authenticated
  using (
    public.is_active_user()
    and exists (
      select 1
      from public.conversations c
      join public.profiles other_profile
        on other_profile.id = case
          when c.participant_1 = (select auth.uid()) then c.participant_2
          else c.participant_1
        end
      where c.id = conversation_id
        and (select auth.uid()) in (c.participant_1, c.participant_2)
        and not other_profile.is_blocked
    )
  );

drop policy if exists "Active participants send messages" on public.messages;
create policy "Active participants send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_active_user()
    and exists (
      select 1
      from public.conversations c
      join public.profiles other_profile
        on other_profile.id = case
          when c.participant_1 = (select auth.uid()) then c.participant_2
          else c.participant_1
        end
      where c.id = conversation_id
        and (select auth.uid()) in (c.participant_1, c.participant_2)
        and not other_profile.is_blocked
    )
  );

revoke all on public.conversations from public, anon, authenticated;
revoke all on public.messages from public, anon, authenticated;
grant select on public.conversations to authenticated;
grant select on public.messages to authenticated;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;

revoke select on public.profiles from anon, authenticated;
revoke select (contact_telegram) on public.profiles from anon, authenticated;
grant select (id, username, full_name, avatar_url, bio, faculty, course, role, is_verified, is_blocked, created_at)
  on public.profiles to anon, authenticated;
revoke update on public.profiles from anon, authenticated;
revoke update (contact_telegram) on public.profiles from anon, authenticated;
grant update (username, full_name, avatar_url, bio, faculty, course, role, is_verified, is_blocked)
  on public.profiles to authenticated;

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

create or replace function public.create_or_get_conversation(
  p_other_user_id uuid,
  p_item_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  first_participant uuid;
  second_participant uuid;
  conversation_id uuid;
begin
  if current_user_id is null or not public.is_active_user() then
    raise exception 'An active account is required to start a chat'
      using errcode = '42501';
  end if;
  if p_other_user_id is null or p_other_user_id = current_user_id then
    raise exception 'Choose another user to start a chat'
      using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_other_user_id and not is_blocked
  ) then
    raise exception 'This user is unavailable'
      using errcode = '22023';
  end if;
  if exists (
    select 1 from public.chat_user_blocks b
    where (b.blocker_id = current_user_id and b.blocked_id = p_other_user_id)
       or (b.blocker_id = p_other_user_id and b.blocked_id = current_user_id)
  ) then
    raise exception 'This user is unavailable'
      using errcode = '42501';
  end if;
  if p_item_id is not null and not exists (
    select 1 from public.items
    where id = p_item_id
      and user_id = p_other_user_id
      and status <> 'hidden'
  ) then
    raise exception 'The listing does not belong to this user'
      using errcode = '22023';
  end if;

  if current_user_id < p_other_user_id then
    first_participant := current_user_id;
    second_participant := p_other_user_id;
  else
    first_participant := p_other_user_id;
    second_participant := current_user_id;
  end if;

  insert into public.conversations as existing (
    participant_1,
    participant_2,
    item_id
  )
  values (first_participant, second_participant, p_item_id)
  on conflict (participant_1, participant_2)
  do update set item_id = coalesce(excluded.item_id, existing.item_id)
  returning id into conversation_id;

  return conversation_id;
end;
$$;

revoke all on function public.create_or_get_conversation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_or_get_conversation(uuid, uuid)
  to authenticated;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  affected_rows integer;
begin
  if current_user_id is null or not public.is_active_user() then
    raise exception 'An active account is required to read messages'
      using errcode = '42501';
  end if;

  update public.conversations c
  set participant_1_last_read_at = case
        when c.participant_1 = current_user_id
          then greatest(c.participant_1_last_read_at, statement_timestamp())
        else c.participant_1_last_read_at
      end,
      participant_2_last_read_at = case
        when c.participant_2 = current_user_id
          then greatest(c.participant_2_last_read_at, statement_timestamp())
        else c.participant_2_last_read_at
      end
  where c.id = p_conversation_id
    and current_user_id in (c.participant_1, c.participant_2)
    and exists (
      select 1
      from public.profiles other_profile
      where other_profile.id = case
        when c.participant_1 = current_user_id then c.participant_2
        else c.participant_1
      end
        and not other_profile.is_blocked
    );

  get diagnostics affected_rows = row_count;
  if affected_rows = 0 then
    raise exception 'Conversation not found or unavailable'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.mark_conversation_read(uuid)
  from public, anon, authenticated;
grant execute on function public.mark_conversation_read(uuid)
  to authenticated;

create or replace function public.get_unread_chat_counts()
returns table (conversation_id uuid, unread_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, count(m.id)::bigint
  from public.conversations c
  join public.messages m on m.conversation_id = c.id
  where public.is_active_user()
    and (
      (c.participant_1 = (select auth.uid())
        and m.sender_id <> (select auth.uid())
        and m.created_at > c.participant_1_last_read_at)
      or
      (c.participant_2 = (select auth.uid())
        and m.sender_id <> (select auth.uid())
        and m.created_at > c.participant_2_last_read_at)
    )
    and exists (
      select 1
      from public.profiles other_profile
      where other_profile.id = case
        when c.participant_1 = (select auth.uid()) then c.participant_2
        else c.participant_1
      end
        and not other_profile.is_blocked
    )
  group by c.id;
$$;

revoke all on function public.get_unread_chat_counts()
  from public, anon, authenticated;
grant execute on function public.get_unread_chat_counts()
  to authenticated;

create or replace function public.update_conversation_after_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set last_message_preview = left(new.body, 240),
      updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists update_conversation_after_message on public.messages;
create trigger update_conversation_after_message
  after insert on public.messages
  for each row execute function public.update_conversation_after_message();

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception when duplicate_object then null;
end
$$;

alter table public.messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;
grant insert (conversation_id, sender_id, body, attachments)
  on public.messages to authenticated;

alter table public.messages
  drop constraint if exists messages_body_check;
alter table public.messages
  drop constraint if exists messages_body_or_attachments_check;
alter table public.messages
  add constraint messages_body_or_attachments_check check (
    (
      char_length(body) between 1 and 4000
      and char_length(btrim(body)) > 0
    )
    or case
      when jsonb_typeof(attachments) = 'array'
        then jsonb_array_length(attachments) > 0
      else false
    end
  );
alter table public.messages
  drop constraint if exists messages_attachments_array_check;
alter table public.messages
  add constraint messages_attachments_array_check check (
    case
      when jsonb_typeof(attachments) = 'array'
        then jsonb_array_length(attachments) <= 5
      else false
    end
  );

create table if not exists public.chat_conversation_state (
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  is_saved boolean not null default false,
  is_archived boolean not null default false,
  is_deleted boolean not null default false,
  primary key (user_id, conversation_id)
);

create table if not exists public.chat_user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint chat_user_blocks_distinct_users check (blocker_id <> blocked_id)
);

create table if not exists public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  created_at timestamptz not null default now(),
  constraint chat_reports_distinct_users check (reporter_id <> reported_user_id)
);

alter table public.chat_conversation_state enable row level security;
alter table public.chat_user_blocks enable row level security;
alter table public.chat_reports enable row level security;

create or replace function public.is_chat_conversation_blocked(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    join public.chat_user_blocks b
      on (b.blocker_id = c.participant_1 and b.blocked_id = c.participant_2)
      or (b.blocker_id = c.participant_2 and b.blocked_id = c.participant_1)
    where c.id = p_conversation_id
      and (select auth.uid()) in (c.participant_1, c.participant_2)
  );
$$;

revoke all on function public.is_chat_conversation_blocked(uuid)
  from public, anon, authenticated;
grant execute on function public.is_chat_conversation_blocked(uuid)
  to authenticated;

drop policy if exists "Users manage their conversation state" on public.chat_conversation_state;
create policy "Users manage their conversation state"
  on public.chat_conversation_state for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.participant_1, c.participant_2)
    )
  )
  with check (
    user_id = (select auth.uid())
    and public.is_active_user()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.participant_1, c.participant_2)
    )
  );

drop policy if exists "Users manage their chat blocks" on public.chat_user_blocks;
create policy "Users manage their chat blocks"
  on public.chat_user_blocks for all to authenticated
  using (blocker_id = (select auth.uid()))
  with check (
    blocker_id = (select auth.uid())
    and public.is_active_user()
    and exists (
      select 1 from public.conversations c
      where (select auth.uid()) in (c.participant_1, c.participant_2)
        and blocked_id in (c.participant_1, c.participant_2)
        and blocked_id <> (select auth.uid())
    )
  );

drop policy if exists "Participants submit chat reports" on public.chat_reports;
create policy "Participants submit chat reports"
  on public.chat_reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and public.is_active_user()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.participant_1, c.participant_2)
        and reported_user_id = case
          when c.participant_1 = (select auth.uid()) then c.participant_2
          else c.participant_1
        end
    )
  );

grant select, insert, update, delete on public.chat_conversation_state to authenticated;
grant select, insert, delete on public.chat_user_blocks to authenticated;
grant insert on public.chat_reports to authenticated;
revoke all on public.chat_reports from anon;

create or replace function public.set_chat_conversation_state(
  p_conversation_id uuid,
  p_is_saved boolean default null,
  p_is_archived boolean default null,
  p_is_deleted boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not public.is_active_user() then
    raise exception 'An active account is required to update a chat'
      using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and current_user_id in (c.participant_1, c.participant_2)
  ) then
    raise exception 'Conversation not found or unavailable'
      using errcode = '42501';
  end if;

  insert into public.chat_conversation_state as existing (
    user_id, conversation_id, is_saved, is_archived, is_deleted
  )
  values (
    current_user_id,
    p_conversation_id,
    coalesce(p_is_saved, false),
    coalesce(p_is_archived, false),
    coalesce(p_is_deleted, false)
  )
  on conflict (user_id, conversation_id)
  do update set
    is_saved = coalesce(p_is_saved, existing.is_saved),
    is_archived = coalesce(p_is_archived, existing.is_archived),
    is_deleted = coalesce(p_is_deleted, existing.is_deleted);
end;
$$;

revoke all on function public.set_chat_conversation_state(uuid, boolean, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.set_chat_conversation_state(uuid, boolean, boolean, boolean)
  to authenticated;

drop policy if exists "Participants read conversations" on public.conversations;
create policy "Participants read conversations"
  on public.conversations for select to authenticated
  using (
    public.is_active_user()
    and (select auth.uid()) in (participant_1, participant_2)
    and exists (
      select 1
      from public.profiles other_profile
      where other_profile.id = case
        when participant_1 = (select auth.uid()) then participant_2
        else participant_1
      end
        and not other_profile.is_blocked
    )
    and not public.is_chat_conversation_blocked(id)
  );

drop policy if exists "Participants read messages" on public.messages;
create policy "Participants read messages"
  on public.messages for select to authenticated
  using (
    public.is_active_user()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.participant_1, c.participant_2)
        and exists (
          select 1 from public.profiles other_profile
          where other_profile.id = case
            when c.participant_1 = (select auth.uid()) then c.participant_2
            else c.participant_1
          end
            and not other_profile.is_blocked
        )
        and not public.is_chat_conversation_blocked(c.id)
    )
  );

drop policy if exists "Active participants send messages" on public.messages;
create policy "Active participants send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_active_user()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.participant_1, c.participant_2)
        and exists (
          select 1 from public.profiles other_profile
          where other_profile.id = case
            when c.participant_1 = (select auth.uid()) then c.participant_2
            else c.participant_1
          end
            and not other_profile.is_blocked
        )
        and not public.is_chat_conversation_blocked(c.id)
    )
  );

create or replace function public.get_unread_chat_counts()
returns table (conversation_id uuid, unread_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, count(m.id)::bigint
  from public.conversations c
  join public.messages m on m.conversation_id = c.id
  left join public.chat_conversation_state s
    on s.conversation_id = c.id and s.user_id = (select auth.uid())
  where public.is_active_user()
    and coalesce(s.is_archived, false) = false
    and coalesce(s.is_deleted, false) = false
    and (
      (c.participant_1 = (select auth.uid())
        and m.sender_id <> (select auth.uid())
        and m.created_at > c.participant_1_last_read_at)
      or
      (c.participant_2 = (select auth.uid())
        and m.sender_id <> (select auth.uid())
        and m.created_at > c.participant_2_last_read_at)
    )
    and exists (
      select 1
      from public.profiles other_profile
      where other_profile.id = case
        when c.participant_1 = (select auth.uid()) then c.participant_2
        else c.participant_1
      end
        and not other_profile.is_blocked
    )
    and not exists (
      select 1 from public.chat_user_blocks b
      where (b.blocker_id = (select auth.uid())
             and b.blocked_id = case
               when c.participant_1 = (select auth.uid()) then c.participant_2
               else c.participant_1
             end)
         or (b.blocked_id = (select auth.uid())
             and b.blocker_id = case
               when c.participant_1 = (select auth.uid()) then c.participant_2
               else c.participant_1
             end)
    )
  group by c.id;
$$;

revoke all on function public.get_unread_chat_counts()
  from public, anon, authenticated;
grant execute on function public.get_unread_chat_counts()
  to authenticated;

create or replace function public.update_conversation_after_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set last_message_preview = left(coalesce(nullif(btrim(new.body), ''), 'Вложение'), 240),
      updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Participants read chat attachments" on storage.objects;
create policy "Participants read chat attachments"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
        and (select auth.uid()) in (c.participant_1, c.participant_2)
    )
  );

drop policy if exists "Users upload their chat attachments" on storage.objects;
create policy "Users upload their chat attachments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and public.is_active_user()
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
        and (select auth.uid()) in (c.participant_1, c.participant_2)
    )
  );

drop policy if exists "Users delete their chat attachments" on storage.objects;
create policy "Users delete their chat attachments"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
