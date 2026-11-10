-- Nepal AI Buyer — database tables.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.

create extension if not exists "pgcrypto";

-- Shops the AI can call.
create table if not exists shops (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null unique,          -- stored as +977…, the format phone services need
  area        text not null,                 -- e.g. Baneshwor
  address     text,
  category    text not null check (category in ('grocery', 'hardware')),
  closes_at   text,                          -- e.g. "8:30 PM"
  lat         double precision,
  lng         double precision,
  our_rating  numeric(2,1),                  -- our own rating from pickups; null until rated
  rating_count int not null default 0,
  active      boolean not null default true, -- untick to stop calling a shop
  consent     boolean not null default false,-- shop agreed to receive AI calls
  notes       text,
  created_at  timestamptz not null default now()
);

-- Customers. Linked to Supabase's built-in login later.
create table if not exists customers (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  phone      text unique,
  city       text default 'Kathmandu',
  created_at timestamptz not null default now()
);

create table if not exists shopping_lists (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  category    text check (category in ('grocery', 'hardware')),
  status      text not null default 'draft'
              check (status in ('draft', 'calling', 'offers_ready', 'ordered', 'cancelled')),
  mode        text not null default 'automatic' check (mode in ('automatic', 'supervised', 'manual')),
  created_at  timestamptz not null default now()
);

create table if not exists list_items (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references shopping_lists(id) on delete cascade,
  name         text not null,
  quantity     numeric not null default 1,
  unit         text not null default 'pcs',
  target_price numeric,
  position     int not null default 0
);

create table if not exists calls (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references shopping_lists(id) on delete cascade,
  shop_id      uuid not null references shops(id),
  vapi_call_id text unique,
  status       text not null default 'queued'
               check (status in ('queued', 'ringing', 'in_progress', 'ended', 'no_answer', 'failed')),
  transcript   jsonb,
  summary      text,
  cost_usd     numeric,
  started_at   timestamptz,
  ended_at     timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists quotes (
  id           uuid primary key default gen_random_uuid(),
  call_id      uuid not null references calls(id) on delete cascade,
  list_item_id uuid not null references list_items(id) on delete cascade,
  asked_price  numeric,   -- shop's first price per unit
  final_price  numeric,   -- after bargaining, per unit
  available    boolean not null default true,
  notes        text
);

create table if not exists orders (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references shopping_lists(id) on delete cascade,
  total       numeric not null,
  fee         numeric not null,
  savings     numeric not null default 0,
  status      text not null default 'ready'
              check (status in ('ready', 'picked_up', 'cancelled')),
  created_at  timestamptz not null default now()
);

-- One row per shop in an order (a list can be split across shops).
create table if not exists order_parts (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  shop_id     uuid not null references shops(id),
  total       numeric not null,
  pickup_by   text,
  rating      int check (rating between 1 and 5)
);

-- Added in step 3: the list exactly as the customer typed it.
alter table shopping_lists add column if not exists raw_text text;
alter table shopping_lists add column if not exists updated_at timestamptz not null default now();

create index if not exists list_items_list on list_items (list_id, position);
create index if not exists shops_category_area on shops (category, area) where active;
create index if not exists calls_list on calls (list_id);
create index if not exists quotes_call on quotes (call_id);

-- Lock every table. Only our own server (using the secret key) can read or
-- write. We'll open specific access for logged-in customers later.
alter table shops          enable row level security;
alter table customers      enable row level security;
alter table shopping_lists enable row level security;
alter table list_items     enable row level security;
alter table calls          enable row level security;
alter table quotes         enable row level security;
alter table orders         enable row level security;
alter table order_parts    enable row level security;
