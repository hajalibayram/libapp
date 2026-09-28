-- Volunteer Bookshop Inventory MVP initial schema.
-- Run this in Supabase SQL Editor or with the Supabase CLI.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('VOLUNTEER', 'ADMIN');
  end if;

  if not exists (select 1 from pg_type where typname = 'inventory_action') then
    create type inventory_action as enum ('ADD', 'REMOVE', 'CORRECTION', 'UNDO');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text unique not null,
  role app_role not null default 'VOLUNTEER',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  isbn13 text unique,
  isbn10 text unique,
  title text not null,
  subtitle text,
  publisher text,
  publication_date text,
  language text,
  description text,
  cover_url text,
  metadata_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint books_has_isbn check (isbn13 is not null or isbn10 is not null)
);

create table if not exists public.authors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.book_authors (
  book_id uuid not null references public.books(id) on delete cascade,
  author_id uuid not null references public.authors(id) on delete restrict,
  primary key (book_id, author_id)
);

create table if not exists public.inventory (
  book_id uuid primary key references public.books(id) on delete cascade,
  quantity integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint inventory_quantity_non_negative check (quantity >= 0)
);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  action inventory_action not null,
  quantity_delta integer not null,
  quantity_before integer not null,
  quantity_after integer not null,
  reverses_transaction_id uuid references public.inventory_transactions(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint transaction_quantity_before_non_negative check (quantity_before >= 0),
  constraint transaction_quantity_after_non_negative check (quantity_after >= 0),
  constraint undo_reverses_transaction check (
    (action = 'UNDO' and reverses_transaction_id is not null)
    or (action <> 'UNDO' and reverses_transaction_id is null)
  )
);

create unique index if not exists inventory_transactions_one_undo_per_transaction
  on public.inventory_transactions (reverses_transaction_id)
  where reverses_transaction_id is not null;

create index if not exists books_isbn13_idx on public.books (isbn13);
create index if not exists books_isbn10_idx on public.books (isbn10);
create index if not exists books_title_idx on public.books (title);
create index if not exists authors_name_idx on public.authors (name);
create index if not exists book_authors_author_id_idx on public.book_authors (author_id);
create index if not exists inventory_transactions_book_id_idx on public.inventory_transactions (book_id);
create index if not exists inventory_transactions_user_id_idx on public.inventory_transactions (user_id);
create index if not exists inventory_transactions_created_at_idx on public.inventory_transactions (created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists books_touch_updated_at on public.books;
create trigger books_touch_updated_at
before update on public.books
for each row execute function public.touch_updated_at();

drop trigger if exists inventory_touch_updated_at on public.inventory;
create trigger inventory_touch_updated_at
before update on public.inventory
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.authors enable row level security;
alter table public.book_authors enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_transactions enable row level security;

-- MVP policy stance:
-- Application API routes will use the server-side service role key for database
-- mutations and authorization checks. Direct browser access is denied unless
-- explicit policies are added later.
