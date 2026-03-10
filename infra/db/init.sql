-- Kawin Database Schema
-- PostgreSQL 16

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enums
CREATE TYPE user_role AS ENUM ('student', 'instructor', 'both', 'admin');
CREATE TYPE workshop_type AS ENUM ('workshop', 'course', 'class', 'event');
CREATE TYPE workshop_modality AS ENUM ('in-person', 'online', 'hybrid');
CREATE TYPE workshop_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded');

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  role user_role NOT NULL DEFAULT 'student',
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  phone VARCHAR(50),
  whatsapp VARCHAR(50),
  telegram VARCHAR(100),
  city VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Chile',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  icon VARCHAR(50),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workshops
CREATE TABLE workshops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON SET NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  type workshop_type NOT NULL DEFAULT 'workshop',
  modality workshop_modality NOT NULL DEFAULT 'in-person',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'CLP',
  capacity INTEGER,
  location VARCHAR(255),
  address TEXT,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  cover_image_url TEXT,
  status workshop_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessions (for multi-session courses)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id UUID NOT NULL REFERENCES workshops(id),
  session_id UUID REFERENCES sessions(id),
  student_id UUID NOT NULL REFERENCES users(id),
  status booking_status NOT NULL DEFAULT 'pending',
  payment_status payment_status NOT NULL DEFAULT 'pending',
  amount NUMERIC(10,2) NOT NULL,
  commission NUMERIC(10,2) NOT NULL DEFAULT 0,
  mp_payment_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reviews
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id UUID NOT NULL REFERENCES workshops(id),
  student_id UUID NOT NULL REFERENCES users(id),
  booking_id UUID REFERENCES bookings(id),
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workshop_id, student_id)
);

-- FAQ Items
CREATE TABLE faq_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workshops_instructor ON workshops(instructor_id);
CREATE INDEX idx_workshops_category ON workshops(category_id);
CREATE INDEX idx_workshops_status ON workshops(status);
CREATE INDEX idx_workshops_type ON workshops(type);
CREATE INDEX idx_workshops_search ON workshops USING gin(to_tsvector('spanish', title || ' ' || COALESCE(description, '')));
CREATE INDEX idx_bookings_student ON bookings(student_id);
CREATE INDEX idx_bookings_workshop ON bookings(workshop_id);
CREATE INDEX idx_reviews_workshop ON reviews(workshop_id);

-- Seed categories
INSERT INTO categories (name, slug, icon) VALUES
  ('Arte y Creatividad', 'arte-creatividad', 'palette'),
  ('Cocina y Gastronomía', 'cocina-gastronomia', 'chef-hat'),
  ('Música y Danza', 'musica-danza', 'music'),
  ('Bienestar y Salud', 'bienestar-salud', 'heart'),
  ('Tecnología', 'tecnologia', 'code'),
  ('Idiomas', 'idiomas', 'globe'),
  ('Deportes', 'deportes', 'activity'),
  ('Negocios', 'negocios', 'briefcase'),
  ('Fotografía', 'fotografia', 'camera'),
  ('Artesanía', 'artesania', 'scissors');
