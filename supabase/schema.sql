-- SWEET GIFT DATABASE — run this entire file in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'customer' check (role in ('admin','customer')),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null default 'Khác',
  sku text unique,
  price numeric(12,0) not null check (price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  customer_phone text,
  shipping_address text,
  note text,
  status text not null default 'pending'
    check (status in ('pending','confirmed','processing','shipping','completed','cancelled')),
  total_amount numeric(12,0) not null default 0 check (total_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,0) not null check (unit_price >= 0),
  line_total numeric(12,0) not null check (line_total >= 0)
);

create index if not exists idx_products_active on public.products(is_active);
create index if not exists idx_orders_created on public.orders(created_at desc);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_order_items_order on public.order_items(order_id);

-- Create a profile whenever an auth account is registered.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id,email,role)
  values(new.id,new.email,'customer')
  on conflict (id) do update set email=excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- RLS helper. SECURITY DEFINER avoids recursive profile policy checks.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "profile self or admin read" on public.profiles;
create policy "profile self or admin read" on public.profiles for select
using (id = auth.uid() or public.is_admin());
drop policy if exists "admin manage profiles" on public.profiles;
create policy "admin manage profiles" on public.profiles for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read active products" on public.products;
create policy "public read active products" on public.products for select
using (is_active = true or public.is_admin());
drop policy if exists "admin manage products" on public.products;
create policy "admin manage products" on public.products for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read categories" on public.categories;
create policy "public read categories" on public.categories for select using (true);
drop policy if exists "admin manage categories" on public.categories;
create policy "admin manage categories" on public.categories for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manage customers" on public.customers;
create policy "admin manage customers" on public.customers for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manage orders" on public.orders;
create policy "admin manage orders" on public.orders for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manage order items" on public.order_items;
create policy "admin manage order items" on public.order_items for all
using (public.is_admin()) with check (public.is_admin());

-- Secure public checkout: the browser submits product IDs + quantities only.
-- Prices and totals are re-read/calculated in PostgreSQL; stock is reserved atomically.
create or replace function public.place_order(
  p_customer_name text,
  p_customer_phone text,
  p_shipping_address text,
  p_items jsonb,
  p_note text default null,
  p_customer_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_order_id uuid;
  v_order_code text;
  v_total numeric(12,0) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
begin
  if coalesce(trim(p_customer_name),'') = '' or coalesce(trim(p_customer_phone),'') = ''
     or coalesce(trim(p_shipping_address),'') = '' then
    raise exception 'Vui lòng nhập đầy đủ tên, số điện thoại và địa chỉ giao hàng';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Giỏ hàng đang trống';
  end if;

  insert into public.customers(full_name,email,phone,address)
  values(trim(p_customer_name),nullif(trim(p_customer_email),''),trim(p_customer_phone),trim(p_shipping_address))
  returning id into v_customer_id;

  v_order_code := 'SG-' || to_char(now(),'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.orders(order_code,customer_id,customer_name,customer_phone,shipping_address,note,status,total_amount)
  values(v_order_code,v_customer_id,trim(p_customer_name),trim(p_customer_phone),trim(p_shipping_address),p_note,'pending',0)
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 50 then raise exception 'Số lượng sản phẩm không hợp lệ'; end if;

    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid and is_active = true
      for update;
    if not found then raise exception 'Một sản phẩm không còn khả dụng'; end if;
    if v_product.stock_quantity < v_qty then raise exception 'Sản phẩm "%" không đủ tồn kho',v_product.name; end if;

    update public.products set stock_quantity = stock_quantity - v_qty, updated_at = now()
      where id = v_product.id;
    insert into public.order_items(order_id,product_id,product_name,quantity,unit_price,line_total)
      values(v_order_id,v_product.id,v_product.name,v_qty,v_product.price,v_product.price*v_qty);
    v_total := v_total + v_product.price*v_qty;
  end loop;

  update public.orders set total_amount=v_total where id=v_order_id;
  return jsonb_build_object('success',true,'order_id',v_order_id,'order_code',v_order_code,'total_amount',v_total);
end;
$$;

-- Allow guest checkout to invoke only the safe RPC. Do not grant direct public insert/update on order tables.
revoke all on function public.place_order(text,text,text,jsonb,text,text) from public;
grant execute on function public.place_order(text,text,text,jsonb,text,text) to anon, authenticated;


-- OPTIONAL STARTER CATALOG: eight demo products matching the current Sweet Gift storefront.
-- Safe to re-run: SKU is unique and rows are upserted.
insert into public.products(name,description,category,sku,price,stock_quantity,image_url,is_active)
values
('Blush Pink Gift Box','Hộp quà tông hồng pastel.','box','SG-BOX-001',289000,20,'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=700&q=80',true),
('Little Teddy Bear','Thú bông nhỏ xinh.','plush','SG-PLUSH-001',159000,25,'https://images.unsplash.com/photo-1559454403-b8fb88521f11?auto=format&fit=crop&w=700&q=80',true),
('Sweet Bloom Bouquet','Bó hoa ngọt ngào.','flower','SG-FLOWER-001',249000,15,'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=700&q=80',true),
('Personalized Memory Box','Hộp quà cá nhân hóa.','custom','SG-CUSTOM-001',359000,12,'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=700&q=80',true),
('Pastel Surprise Set','Bộ quà bất ngờ pastel.','box','SG-BOX-002',319000,18,'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?auto=format&fit=crop&w=700&q=80',true),
('Mini Bunny Plush','Thú bông thỏ mini.','plush','SG-PLUSH-002',139000,20,'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=700&q=80',true),
('Pink Note & Flowers','Thiệp và hoa tông hồng.','flower','SG-FLOWER-002',199000,16,'https://images.unsplash.com/photo-1520763185298-1b434c919102?auto=format&fit=crop&w=700&q=80',true),
('Name-Printed Keepsake','Món quà lưu niệm cá nhân hóa.','custom','SG-CUSTOM-002',229000,14,'https://images.unsplash.com/photo-1513883049090-d0b7439799bf?auto=format&fit=crop&w=700&q=80',true)
on conflict (sku) do update set
  name=excluded.name,
  description=excluded.description,
  category=excluded.category,
  price=excluded.price,
  image_url=excluded.image_url,
  is_active=excluded.is_active,
  updated_at=now();
