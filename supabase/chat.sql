-- Run after supabase/schema.sql to enable private, real-time direct messages.
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_1 uuid not null references public.profiles(id) on delete cascade,
  participant_2 uuid not null references public.profiles(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  last_message_preview text not null default ''
    check (char_length(last_message_preview) <= 240),
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

create index if not exists conversations_participant_1_updated_at_idx
  on public.conversations (participant_1, updated_at desc);
create index if not exists conversations_participant_2_updated_at_idx
  on public.conversations (participant_2, updated_at desc);
create index if not exists messages_conversation_created_at_idx
  on public.messages (conversation_id, created_at);

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

grant select on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;

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
grant select (id, user_id, type, title, description, category, location, date, photos, status, created_at, updated_at)
  on public.items to anon, authenticated;
revoke insert, update on public.items from authenticated;
revoke insert (contact_method), update (contact_method) on public.items from authenticated;
grant insert (id, user_id, type, title, description, category, location, date, photos, status)
  on public.items to authenticated;
grant update (title, description, category, location, date, photos, status)
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
  do update set item_id = coalesce(existing.item_id, excluded.item_id)
  returning id into conversation_id;

  return conversation_id;
end;
$$;

revoke all on function public.create_or_get_conversation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_or_get_conversation(uuid, uuid)
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
