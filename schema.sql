-- ============================================================
-- LUXE SALON - Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- USERS (customers)
create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password text not null,
  phone text,
  role text default 'customer',
  created_at timestamptz default now()
);

-- ADMINS
create table admins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password text not null,
  role text default 'admin',
  created_at timestamptz default now()
);

-- SERVICES
create table services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null,
  duration_minutes int not null,
  category text not null,
  image_url text,
  avg_rating numeric(3,1) default 0,
  review_count int default 0,
  created_at timestamptz default now()
);

-- BOOKINGS
create table bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  date date not null,
  time_slot text not null,
  notes text,
  total_price numeric(10,2),
  status text default 'pending', -- pending | confirmed | completed | cancelled
  created_at timestamptz default now()
);

-- BOOKING_SERVICES (many-to-many)
create table booking_services (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  service_id uuid references services(id) on delete cascade
);

-- REVIEWS
create table reviews (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references services(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  rating int check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz default now(),
  unique(service_id, user_id) -- one review per user per service
);

-- ============================================================
-- SEED DATA - Services
-- ============================================================

insert into services (name, description, price, duration_minutes, category, image_url, avg_rating, review_count) values
-- Hair
('Classic Haircut', 'Precision cut tailored to your face shape and style preferences.', 45, 45, 'Hair', null, 4.8, 124),
('Hair Color & Highlights', 'Full color or partial highlights with premium products.', 120, 120, 'Hair', null, 4.7, 89),
('Balayage', 'Hand-painted color for a natural sun-kissed effect.', 180, 150, 'Hair', null, 4.9, 67),
('Keratin Treatment', 'Smoothing treatment for frizz-free, shiny hair for up to 3 months.', 250, 180, 'Hair', null, 4.6, 45),
('Hair Gloss Treatment', 'Boosts shine, reduces frizz, and enhances your color.', 85, 60, 'Hair', null, 4.7, 38),
('Scalp Treatment', 'Deep nourishing treatment for a healthy scalp.', 65, 45, 'Hair', null, 4.5, 29),
('Blowout & Style', 'Professional blow-dry and style for any occasion.', 55, 45, 'Hair', null, 4.8, 102),
('Hair Extensions', 'High quality extensions for length and volume.', 350, 240, 'Hair', null, 4.6, 22),
('Perm', 'Long-lasting waves or curls for a transformative look.', 150, 180, 'Hair', null, 4.4, 18),
('Deep Conditioning', 'Intensive moisture therapy for dry or damaged hair.', 70, 60, 'Hair', null, 4.7, 54),

-- Nails
('Classic Manicure', 'Nail shaping, cuticle care, and polish of your choice.', 35, 45, 'Nails', null, 4.7, 156),
('Gel Manicure', 'Long-lasting gel polish with UV cure — lasts 2-3 weeks.', 55, 60, 'Nails', null, 4.8, 134),
('Nail Art', 'Custom designs, patterns, and embellishments.', 75, 90, 'Nails', null, 4.9, 78),
('Classic Pedicure', 'Foot soak, scrub, nail care, and polish.', 45, 60, 'Nails', null, 4.6, 98),
('Spa Pedicure', 'Luxury treatment with mask, massage, and exfoliation.', 75, 90, 'Nails', null, 4.8, 87),
('Acrylic Nails', 'Full set of acrylic extensions in your desired shape.', 90, 90, 'Nails', null, 4.5, 62),
('Dip Powder Nails', 'Durable and lightweight dip powder finish.', 65, 75, 'Nails', null, 4.7, 44),
('Nail Removal', 'Safe removal of gel, acrylic, or dip powder nails.', 25, 30, 'Nails', null, 4.6, 55),
('Paraffin Wax Treatment', 'Deeply moisturizing wax treatment for hands or feet.', 40, 30, 'Nails', null, 4.7, 31),
('Chrome Powder Nails', 'Mirror-finish chrome effect for a bold statement.', 85, 90, 'Nails', null, 4.8, 27),

-- Skin
('Classic Facial', 'Deep cleanse, exfoliation, and hydration for glowing skin.', 95, 60, 'Skin', null, 4.7, 88),
('Anti-Aging Facial', 'Targeted treatment to reduce fine lines and boost collagen.', 145, 75, 'Skin', null, 4.8, 54),
('Hydrating Facial', 'Intense moisture boost for dry or dehydrated skin.', 110, 60, 'Skin', null, 4.7, 47),
('Acne Treatment Facial', 'Targets breakouts, reduces inflammation, and clears pores.', 125, 75, 'Skin', null, 4.6, 36),
('Microdermabrasion', 'Crystal exfoliation to resurface and brighten skin.', 135, 60, 'Skin', null, 4.5, 29),
('Chemical Peel', 'Light to medium peel for smoother, brighter skin.', 160, 60, 'Skin', null, 4.6, 24),
('LED Light Therapy', 'Targeted light treatment for anti-aging or acne.', 80, 30, 'Skin', null, 4.7, 41),
('Eyebrow Shaping & Tinting', 'Precision shaping with optional tint for defined brows.', 45, 30, 'Skin', null, 4.8, 112),
('Lash Lift & Tint', 'Lift and curl your natural lashes with optional tint.', 85, 60, 'Skin', null, 4.9, 76),
('Full Face Waxing', 'Upper lip, chin, and brow wax for smooth, hair-free skin.', 55, 30, 'Skin', null, 4.6, 65),

-- Spa & Body
('Swedish Massage', 'Relaxing full-body massage to ease tension and stress.', 110, 60, 'Spa & Body', null, 4.9, 134),
('Deep Tissue Massage', 'Firm pressure targeting deep muscle tension.', 130, 60, 'Spa & Body', null, 4.8, 98),
('Hot Stone Massage', 'Heated stones combined with massage for ultimate relaxation.', 150, 90, 'Spa & Body', null, 4.9, 72),
('Body Scrub', 'Full-body exfoliation for silky smooth skin.', 95, 60, 'Spa & Body', null, 4.7, 45),
('Body Wrap', 'Detoxifying wrap for skin softening and slimming effects.', 120, 75, 'Spa & Body', null, 4.6, 32),
('Aromatherapy Massage', 'Relaxing massage with custom essential oil blends.', 125, 75, 'Spa & Body', null, 4.8, 56),
('Couples Massage', 'Shared relaxation experience in a private suite.', 240, 60, 'Spa & Body', null, 4.9, 41),
('Foot Reflexology', 'Pressure point therapy on feet for full-body wellness.', 75, 45, 'Spa & Body', null, 4.7, 38),

-- Makeup
('Everyday Makeup', 'Natural, polished look for daily wear.', 75, 45, 'Makeup', null, 4.7, 67),
('Bridal Makeup', 'Full glam bridal look with long-lasting formula.', 200, 90, 'Makeup', null, 4.9, 43),
('Special Occasion Makeup', 'Event-ready makeup for any occasion.', 120, 60, 'Makeup', null, 4.8, 58),
('Makeup Lesson', 'One-on-one tutorial to perfect your own technique.', 150, 90, 'Makeup', null, 4.8, 29),
('Airbrush Makeup', 'Flawless airbrushed finish for photography or events.', 160, 75, 'Makeup', null, 4.7, 22);

-- ============================================================
-- SEED ADMIN - Default admin account
-- Password: Admin@123 (bcrypt hash below)
-- CHANGE THIS PASSWORD AFTER FIRST LOGIN
-- ============================================================

insert into admins (name, email, password) values (
  'Salon Admin',
  'admin@luxesalon.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' -- password: password (change this!)
);

-- ============================================================
-- Row Level Security (optional but recommended)
-- ============================================================

alter table users enable row level security;
alter table bookings enable row level security;
alter table reviews enable row level security;

-- Allow backend (service role) to bypass RLS
-- Your backend uses the service role key, so it bypasses RLS automatically.
