-- Run this once in Supabase SQL Editor.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text not null unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

insert into public.profiles (id, email, username)
select
  id,
  email,
  lower(split_part(email, '@', 1))
from auth.users
where email is not null
on conflict (id) do nothing;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.get_email_by_username(lookup_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select email from public.profiles
  where lower(username) = lower(lookup_username)
  limit 1;
$$;

revoke all on function public.get_email_by_username(text) from public;
grant execute on function public.get_email_by_username(text) to anon, authenticated;

create or replace function public.search_profiles(search_username text)
returns table (id uuid, username text)
language sql
security definer
set search_path = public
as $$
  select profiles.id, profiles.username
  from public.profiles
  where lower(profiles.username) like '%' || lower(search_username) || '%'
  order by profiles.username
  limit 10;
$$;

revoke all on function public.search_profiles(text) from public;
grant execute on function public.search_profiles(text) to authenticated;

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (sender_id, receiver_id),
  check (sender_id <> receiver_id)
);

alter table public.friend_requests enable row level security;

drop policy if exists "Users can read their own friend requests" on public.friend_requests;
create policy "Users can read their own friend requests"
  on public.friend_requests for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Users can send friend requests" on public.friend_requests;
create policy "Users can send friend requests"
  on public.friend_requests for insert
  with check (auth.uid() = sender_id);

drop policy if exists "Receivers can update friend requests" on public.friend_requests;
create policy "Receivers can update friend requests"
  on public.friend_requests for update
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

drop policy if exists "Friends can remove their friendship" on public.friend_requests;
create policy "Friends can remove their friendship"
  on public.friend_requests for delete
  using ((auth.uid() = sender_id or auth.uid() = receiver_id) and status = 'accepted');

create or replace function public.send_friend_request(target_user_id uuid)
returns public.friend_requests
language plpgsql
security invoker
set search_path = public
as $$
declare created_request public.friend_requests;
begin
  insert into public.friend_requests (sender_id, receiver_id)
  values (auth.uid(), target_user_id)
  on conflict (sender_id, receiver_id) do update
    set status = 'pending', created_at = now()
  returning * into created_request;
  return created_request;
end;
$$;

create or replace function public.get_pending_friend_requests()
returns table (id uuid, sender_id uuid, sender_username text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select requests.id, requests.sender_id, profiles.username, requests.created_at
  from public.friend_requests requests
  join public.profiles profiles on profiles.id = requests.sender_id
  where requests.receiver_id = auth.uid() and requests.status = 'pending'
  order by requests.created_at desc;
$$;

create or replace function public.respond_friend_request(request_id uuid, next_status text)
returns public.friend_requests
language plpgsql
security invoker
set search_path = public
as $$
declare updated_request public.friend_requests;
begin
  if next_status not in ('accepted', 'rejected') then
    raise exception 'Invalid friend request status';
  end if;

  update public.friend_requests
  set status = next_status
  where id = request_id and receiver_id = auth.uid() and status = 'pending'
  returning * into updated_request;
  return updated_request;
end;
$$;

create or replace function public.get_friends()
returns table (id uuid, username text)
language sql
security definer
set search_path = public
as $$
  select profiles.id, profiles.username
  from public.friend_requests requests
  join public.profiles profiles
    on profiles.id = case
      when requests.sender_id = auth.uid() then requests.receiver_id
      else requests.sender_id
    end
  where (requests.sender_id = auth.uid() or requests.receiver_id = auth.uid())
    and requests.status = 'accepted'
  order by profiles.username;
$$;

create or replace function public.remove_friend(friend_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.friend_requests
  where status = 'accepted'
    and ((sender_id = auth.uid() and receiver_id = friend_user_id)
      or (receiver_id = auth.uid() and sender_id = friend_user_id));
end;
$$;

revoke all on function public.send_friend_request(uuid) from public;
revoke all on function public.get_pending_friend_requests() from public;
revoke all on function public.respond_friend_request(uuid, text) from public;
revoke all on function public.get_friends() from public;
revoke all on function public.remove_friend(uuid) from public;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.get_pending_friend_requests() to authenticated;
grant execute on function public.respond_friend_request(uuid, text) to authenticated;
grant execute on function public.get_friends() to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;

create or replace function public.get_current_health()
returns table (health_points integer, missed_habits integer, week_start date)
language plpgsql
security definer
set search_path = public
as $$
declare
  local_now timestamp := now() at time zone 'Asia/Makassar';
  monday_start timestamp;
  current_week_start date;
  missed_count integer;
begin
  monday_start := date_trunc('week', local_now) + interval '7 hours';
  if local_now < monday_start then
    current_week_start := (monday_start - interval '7 days')::date;
  else
    current_week_start := monday_start::date;
  end if;

  select count(*)::integer into missed_count
  from public.habits habits
  cross join lateral generate_series(
    current_week_start,
    case when local_now::time >= time '07:00' then local_now::date - 1 else local_now::date - 2 end,
    interval '1 day'
  ) missed_day
  where habits.user_id = auth.uid()
    and (habits.created_at at time zone 'Asia/Makassar')::date <= missed_day::date
    and not exists (
      select 1
      from public.habit_completions completions
      where completions.habit_id = habits.id
        and completions.completed_date = missed_day::date
    );

  return query select greatest(0, 100 - (missed_count * 10)), missed_count, current_week_start;
end;
$$;

revoke all on function public.get_current_health() from public;
grant execute on function public.get_current_health() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username)
  values (
    new.id,
    new.email,
    lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)))
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();