-- ─────────────────────────────────────────────────────────────────────────────
-- Kawin QA — Setup completo de base de datos
-- Ejecutar contra una base de datos PostgreSQL 16 vacía.
-- Idempotente: seguro de re-ejecutar (IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Extensions ───────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('student', 'instructor', 'both', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE workshop_type AS ENUM ('workshop', 'course', 'class', 'event');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE workshop_modality AS ENUM ('in-person', 'online', 'hybrid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE workshop_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email          VARCHAR(255) UNIQUE NOT NULL,
  password_hash  VARCHAR(255),
  role           user_role NOT NULL DEFAULT 'student',
  email_verified BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  bio           TEXT,
  avatar_url    TEXT,
  phone         VARCHAR(50),
  whatsapp      VARCHAR(50),
  telegram      VARCHAR(100),
  city          VARCHAR(100),
  country       VARCHAR(100) DEFAULT 'Chile',
  instagram_url VARCHAR(255),
  facebook_url  VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  icon        VARCHAR(50),
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workshops (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id        UUID REFERENCES categories(id) ON DELETE SET NULL,
  title              VARCHAR(255) NOT NULL,
  slug               VARCHAR(255) UNIQUE NOT NULL,
  description        TEXT,
  type               workshop_type NOT NULL DEFAULT 'workshop',
  modality           workshop_modality NOT NULL DEFAULT 'in-person',
  price              NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency           VARCHAR(3) NOT NULL DEFAULT 'CLP',
  capacity           INTEGER,
  location           VARCHAR(255),
  address            TEXT,
  lat                NUMERIC(10,7),
  lng                NUMERIC(10,7),
  online_url         TEXT,
  cover_image_url    TEXT,
  status             workshop_status NOT NULL DEFAULT 'draft',
  approval_status    VARCHAR(30) NOT NULL DEFAULT 'not_submitted'
                     CHECK (approval_status IN ('not_submitted','pending_review','approved','changes_requested')),
  admin_observations TEXT,
  reviewed_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedules (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id  UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  days_of_week INTEGER[] NOT NULL,
  time_start   TIME NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 60,
  valid_from   DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until  DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  cancelled   BOOLEAN NOT NULL DEFAULT FALSE,
  notes       TEXT,
  online_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workshop_id, schedule_id, starts_at)
);

CREATE TABLE IF NOT EXISTS bookings (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id              UUID NOT NULL REFERENCES workshops(id),
  session_id               UUID REFERENCES sessions(id),
  student_id               UUID NOT NULL REFERENCES users(id),
  status                   booking_status NOT NULL DEFAULT 'pending',
  payment_status           payment_status NOT NULL DEFAULT 'pending',
  amount                   NUMERIC(10,2) NOT NULL,
  commission               NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_absorbed_by   VARCHAR(20),
  cancelled_reason         VARCHAR(50),
  migrated_from_session_id UUID REFERENCES sessions(id),
  mp_payment_id            VARCHAR(255),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id UUID NOT NULL REFERENCES workshops(id),
  student_id  UUID NOT NULL REFERENCES users(id),
  booking_id  UUID REFERENCES bookings(id),
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workshop_id, student_id)
);

CREATE TABLE IF NOT EXISTS faq_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            VARCHAR(255) NOT NULL,
  notifiable_type VARCHAR(255) NOT NULL,
  notifiable_id   UUID NOT NULL,
  data            TEXT NOT NULL,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS discounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  session_id  UUID REFERENCES sessions(id) ON DELETE CASCADE,
  type        VARCHAR(10) NOT NULL CHECK (type IN ('percent', 'flat')),
  value       NUMERIC(10,2) NOT NULL CHECK (value > 0),
  label       VARCHAR(255) NOT NULL DEFAULT '',
  max_uses    INTEGER,
  uses_count  INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  valid_from  TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_workshops_instructor  ON workshops(instructor_id);
CREATE INDEX IF NOT EXISTS idx_workshops_category    ON workshops(category_id);
CREATE INDEX IF NOT EXISTS idx_workshops_status      ON workshops(status);
CREATE INDEX IF NOT EXISTS idx_workshops_type        ON workshops(type);
CREATE INDEX IF NOT EXISTS idx_workshops_search      ON workshops
  USING gin(to_tsvector('spanish', title || ' ' || COALESCE(description, '')));
CREATE INDEX IF NOT EXISTS idx_bookings_student      ON bookings(student_id);
CREATE INDEX IF NOT EXISTS idx_bookings_workshop     ON bookings(workshop_id);
CREATE INDEX IF NOT EXISTS idx_reviews_workshop      ON reviews(workshop_id);
CREATE INDEX IF NOT EXISTS idx_schedules_workshop    ON schedules(workshop_id);
CREATE INDEX IF NOT EXISTS idx_sessions_schedule     ON sessions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_sessions_cancelled    ON sessions(cancelled);
CREATE INDEX IF NOT EXISTS idx_notifications_notif   ON notifications(notifiable_type, notifiable_id, read_at);
CREATE INDEX IF NOT EXISTS idx_discounts_workshop    ON discounts(workshop_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_discounts_session     ON discounts(session_id)  WHERE active = true AND session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED DATA
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Categorías ───────────────────────────────────────────────────────────────

INSERT INTO categories (name, slug, icon) VALUES
  ('Arte y Creatividad',   'arte-creatividad',  'palette'),
  ('Cocina y Gastronomía', 'cocina-gastronomia','chef-hat'),
  ('Música y Danza',       'musica-danza',      'music'),
  ('Bienestar y Salud',    'bienestar-salud',   'heart'),
  ('Tecnología',           'tecnologia',        'code'),
  ('Idiomas',              'idiomas',           'globe'),
  ('Deportes',             'deportes',          'activity'),
  ('Negocios',             'negocios',          'briefcase'),
  ('Fotografía',           'fotografia',        'camera'),
  ('Artesanía',            'artesania',         'scissors')
ON CONFLICT (slug) DO NOTHING;

-- ─── Usuarios (password: test1234) ───────────────────────────────────────────

INSERT INTO users (id, email, password_hash, role) VALUES
  ('00000000-0000-0000-0000-000000000099', 'admin@kawin.app',
   '$2a$10$8lU7Wn25aYsRnBURkQB.Q.ZeOcDorE1W9h3RSMxwuMAoW.xlV/rhW', 'admin'),
  ('00000000-0000-0000-0000-000000000001', 'maria@kawin.app',
   '$2a$10$8lU7Wn25aYsRnBURkQB.Q.ZeOcDorE1W9h3RSMxwuMAoW.xlV/rhW', 'instructor'),
  ('00000000-0000-0000-0000-000000000002', 'carlos@kawin.app',
   '$2a$10$8lU7Wn25aYsRnBURkQB.Q.ZeOcDorE1W9h3RSMxwuMAoW.xlV/rhW', 'student'),
  ('00000000-0000-0000-0000-000000000003', 'jorge@kawin.app',
   '$2a$10$8lU7Wn25aYsRnBURkQB.Q.ZeOcDorE1W9h3RSMxwuMAoW.xlV/rhW', 'instructor'),
  ('00000000-0000-0000-0000-000000000004', 'camila@kawin.app',
   '$2a$10$8lU7Wn25aYsRnBURkQB.Q.ZeOcDorE1W9h3RSMxwuMAoW.xlV/rhW', 'instructor'),
  ('00000000-0000-0000-0000-000000000005', 'pablo@kawin.app',
   '$2a$10$8lU7Wn25aYsRnBURkQB.Q.ZeOcDorE1W9h3RSMxwuMAoW.xlV/rhW', 'instructor')
ON CONFLICT (email) DO NOTHING;

INSERT INTO profiles (user_id, name, bio, city, country) VALUES
  ('00000000-0000-0000-0000-000000000099', 'Administrador Kawin',
   'Equipo de revisión y moderación de Kawin.', 'Santiago', 'Chile'),
  ('00000000-0000-0000-0000-000000000001', 'María González',
   'Artista visual con 10 años de experiencia. Estudié Bellas Artes en la Universidad de Chile.',
   'Santiago', 'Chile'),
  ('00000000-0000-0000-0000-000000000002', 'Carlos Moreno',
   'Apasionado por la música y el bienestar. Siempre buscando aprender algo nuevo.',
   'Santiago', 'Chile'),
  ('00000000-0000-0000-0000-000000000003', 'Jorge Castillo',
   'DJ y productor musical con 15 años en la escena electrónica chilena. Residente del Club Nomade y festival Pulsar. Enseño producción musical con Ableton Live desde 2020.',
   'Santiago', 'Chile'),
  ('00000000-0000-0000-0000-000000000004', 'Camila Rojas',
   'Escritora y editora con Magíster en Literatura. Autora de dos libros de cuentos y columnista en The Clinic. Dicto talleres de escritura creativa desde 2019.',
   'Santiago', 'Chile'),
  ('00000000-0000-0000-0000-000000000005', 'Pablo Morales',
   'Emprendedor en serie y consultor de negocios. Fundé tres startups y asesoro pymes. Speaker en TEDx Santiago 2023.',
   'Santiago', 'Chile')
ON CONFLICT (user_id) DO NOTHING;

-- ─── Talleres ─────────────────────────────────────────────────────────────────

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000001', id,
  'Acuarela para principiantes', 'acuarela-principiantes',
  'Aprende las bases de la acuarela en un ambiente relajado y creativo. Técnicas húmedo sobre húmedo, degradados y mezcla de colores. Todos los materiales incluidos.',
  'workshop', 'in-person', 25000, 'CLP', 12, 'Barrio Italia, Santiago', 'published'
FROM categories WHERE slug = 'arte-creatividad' ON CONFLICT (slug) DO NOTHING;

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000001', id,
  'Fotografía callejera', 'fotografia-callejera',
  'Salimos a las calles de Santiago a capturar el momento decisivo. Aprende composición, luz natural y edición básica. Cámara propia requerida.',
  'workshop', 'in-person', 30000, 'CLP', 6, 'Barrio Italia, Santiago', 'published'
FROM categories WHERE slug = 'fotografia' ON CONFLICT (slug) DO NOTHING;

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000001', id,
  'Macramé desde cero: tu primera pieza', 'macrame-principiantes',
  'El macramé es el arte de anudar cordones para crear piezas decorativas. No necesitas habilidades previas. En 3 horas crearás un colgante de pared de 40 cm con los nudos básicos: cuadrado, alondra y espiral. Todo incluido: cordón de algodón natural, palito de madera y patrones. Máximo 8 personas.',
  'workshop', 'in-person', 28000, 'CLP', 8, 'Taller La Hebra, Ñuñoa, Santiago', 'published'
FROM categories WHERE slug = 'artesania' ON CONFLICT (slug) DO NOTHING;

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000001', id,
  'Cerámica a torno', 'ceramica-torno',
  'Iníciate en el fascinante mundo de la cerámica con torno eléctrico. Arcilla y materiales incluidos. Te llevas tu pieza del día.',
  'workshop', 'in-person', 55000, 'CLP', 6, 'Ñuñoa, Santiago', 'published'
FROM categories WHERE slug = 'artesania' ON CONFLICT (slug) DO NOTHING;

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000003', id,
  'Guitarra flamenca online', 'guitarra-flamenca',
  'Técnica y ritmo flamenco para músicos con conocimientos básicos. Clases en vivo con grabación disponible.',
  'class', 'online', 15000, 'CLP', NULL, NULL, 'published'
FROM categories WHERE slug = 'musica-danza' ON CONFLICT (slug) DO NOTHING;

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000003', id,
  'Open Mic Jazz Night — Abril 2026', 'open-mic-jazz-abril-2026',
  'Una noche especial para músicos de jazz de todos los niveles. La primera hora es para músicos registrados con turnos de 15 minutos. La segunda es una jam session abierta. El estudio cuenta con piano de cola Yamaha, batería, amplificadores y PA profesional. Solo trae tu instrumento.',
  'event', 'in-person', 8000, 'CLP', 40, 'Estudio La Fábrica, Barrio Yungay, Santiago', 'published'
FROM categories WHERE slug = 'musica-danza' ON CONFLICT (slug) DO NOTHING;

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000003', id,
  'Producción Musical con Ableton Live', 'produccion-musical-ableton',
  'Aprende a producir música electrónica profesional desde tu computador. Clases semanales online en vivo de 2 horas. Temario: interfaz y Session View, síntesis básica, sampleo y beat making, mezcla y efectos, exportación. Necesitas Ableton Live (versión trial gratuita funciona).',
  'class', 'online', 35000, 'CLP', 12, NULL, 'published'
FROM categories WHERE slug = 'tecnologia' ON CONFLICT (slug) DO NOTHING;

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000004', id,
  'Escritura Creativa: Encuentra tu Voz', 'escritura-creativa-voz-propia',
  'Un curso de 6 semanas para escritores que quieren encontrar lo que realmente tienen que decir. Cada semana incluye clase teórica, ejercicio con entrega, retroalimentación individual y sesión grupal en vivo los miércoles a las 19:00. Trabajaremos cuento, crónica y escritura autobiográfica. Cupo máximo 10 personas.',
  'course', 'online', 120000, 'CLP', 10, NULL, 'published'
FROM categories WHERE slug = 'idiomas' ON CONFLICT (slug) DO NOTHING;

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000004', id,
  'Spanish for Beginners — Chilean Style', 'spanish-for-beginners-chilean',
  'Learn Spanish with a focus on Chilean Spanish — the most colorful and fast variety. Classes online via Zoom, 90 minutes each. Topics: greetings and Chilean slang, numbers and transport, food and restaurants, culture and humor. Maximum 8 students.',
  'class', 'online', 25000, 'CLP', 8, NULL, 'published'
FROM categories WHERE slug = 'idiomas' ON CONFLICT (slug) DO NOTHING;

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000005', id,
  'Pitch Perfect: Presenta tu idea en 3 minutos', 'pitch-perfect-emprendedores',
  'Tienes una idea de negocio pero no sabes cómo presentarla. En 4 horas intensivas aprenderás la estructura de un pitch ganador, cómo conectar emocionalmente con tu audiencia y practicarás frente al grupo. Incluye: framework de 3 minutos, comunicación no verbal, 3 rondas de práctica y grabación del pitch final. Máximo 10 personas.',
  'workshop', 'in-person', 65000, 'CLP', 10, 'WeWork Apoquindo, Las Condes, Santiago', 'published'
FROM categories WHERE slug = 'negocios' ON CONFLICT (slug) DO NOTHING;

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000001', id,
  'Cocina italiana desde cero', 'cocina-italiana',
  'Pasta, risotto y salsas auténticas con ingredientes locales. Un viaje gastronómico sin salir de Santiago.',
  'course', 'in-person', 45000, 'CLP', 8, 'Providencia, Santiago', 'published'
FROM categories WHERE slug = 'cocina-gastronomia' ON CONFLICT (slug) DO NOTHING;

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000001', id,
  'Yoga restaurativo', 'yoga-restaurativo',
  'Práctica suave enfocada en la recuperación y el bienestar profundo. Ideal para reducir el estrés y reconectar con el cuerpo.',
  'class', 'hybrid', 12000, 'CLP', 15, 'Las Condes, Santiago', 'published'
FROM categories WHERE slug = 'bienestar-salud' ON CONFLICT (slug) DO NOTHING;

-- ─── Schedules (tipo class) ───────────────────────────────────────────────────

INSERT INTO schedules (workshop_id, days_of_week, time_start, duration_min, valid_from)
SELECT id, ARRAY[2, 4], '19:00', 90, CURRENT_DATE
FROM workshops WHERE slug = 'guitarra-flamenca' ON CONFLICT DO NOTHING;

INSERT INTO schedules (workshop_id, days_of_week, time_start, duration_min, valid_from)
SELECT id, ARRAY[1], '20:00', 120, CURRENT_DATE
FROM workshops WHERE slug = 'produccion-musical-ableton' ON CONFLICT DO NOTHING;

INSERT INTO schedules (workshop_id, days_of_week, time_start, duration_min, valid_from)
SELECT id, ARRAY[3], '18:00', 90, CURRENT_DATE
FROM workshops WHERE slug = 'spanish-for-beginners-chilean' ON CONFLICT DO NOTHING;

INSERT INTO schedules (workshop_id, days_of_week, time_start, duration_min, valid_from)
SELECT id, ARRAY[1, 3, 5], '08:00', 60, CURRENT_DATE
FROM workshops WHERE slug = 'yoga-restaurativo' ON CONFLICT DO NOTHING;

-- ─── Sessions (talleres no-class) ─────────────────────────────────────────────

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days' + INTERVAL '3 hours',
  'Materiales incluidos. Traer delantal.'
FROM workshops WHERE slug = 'acuarela-principiantes' ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days' + INTERVAL '4 hours',
  'Traer cámara propia. Punto de encuentro: Metro Baquedano.'
FROM workshops WHERE slug = 'fotografia-callejera' ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, NOW() + INTERVAL '21 days', NOW() + INTERVAL '21 days' + INTERVAL '4 hours',
  'Traer cámara propia. Punto de encuentro: Metro Baquedano.'
FROM workshops WHERE slug = 'fotografia-callejera' ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days' + INTERVAL '3 hours',
  'Todos los materiales incluidos.'
FROM workshops WHERE slug = 'macrame-principiantes' ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, NOW() + INTERVAL '19 days', NOW() + INTERVAL '19 days' + INTERVAL '3 hours',
  'Todos los materiales incluidos.'
FROM workshops WHERE slug = 'macrame-principiantes' ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, NOW() + INTERVAL '10 days', NOW() + INTERVAL '10 days' + INTERVAL '3 hours',
  'Delantal incluido.'
FROM workshops WHERE slug = 'ceramica-torno' ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, NOW() + INTERVAL '24 days', NOW() + INTERVAL '24 days' + INTERVAL '3 hours',
  'Delantal incluido.'
FROM workshops WHERE slug = 'ceramica-torno' ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, NOW() + INTERVAL '15 days', NOW() + INTERVAL '15 days' + INTERVAL '3 hours 30 minutes',
  'Llegar 30 min antes para soundcheck.'
FROM workshops WHERE slug = 'open-mic-jazz-abril-2026' ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, NOW() + INTERVAL '7 days',  NOW() + INTERVAL '7 days'  + INTERVAL '1 hour 30 minutes', 'Semana 1: El punto de partida.'
FROM workshops WHERE slug = 'escritura-creativa-voz-propia' ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days' + INTERVAL '1 hour 30 minutes', 'Semana 2: La voz narrativa.'
FROM workshops WHERE slug = 'escritura-creativa-voz-propia' ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, NOW() + INTERVAL '21 days', NOW() + INTERVAL '21 days' + INTERVAL '1 hour 30 minutes', 'Semana 3: El tiempo y el espacio.'
FROM workshops WHERE slug = 'escritura-creativa-voz-propia' ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, NOW() + INTERVAL '28 days', NOW() + INTERVAL '28 days' + INTERVAL '1 hour 30 minutes', 'Semana 4: El conflicto.'
FROM workshops WHERE slug = 'escritura-creativa-voz-propia' ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, NOW() + INTERVAL '35 days', NOW() + INTERVAL '35 days' + INTERVAL '1 hour 30 minutes', 'Semana 5: El final.'
FROM workshops WHERE slug = 'escritura-creativa-voz-propia' ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, NOW() + INTERVAL '42 days', NOW() + INTERVAL '42 days' + INTERVAL '1 hour 30 minutes', 'Semana 6: Lectura pública.'
FROM workshops WHERE slug = 'escritura-creativa-voz-propia' ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, NOW() + INTERVAL '10 days', NOW() + INTERVAL '10 days' + INTERVAL '4 hours',
  'Trae tu idea o empresa actual.'
FROM workshops WHERE slug = 'pitch-perfect-emprendedores' ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, NOW() + INTERVAL '7 days',  NOW() + INTERVAL '7 days'  + INTERVAL '3 hours', 'Sesión 1: Pasta fresca y salsas básicas.'
FROM workshops WHERE slug = 'cocina-italiana' ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days' + INTERVAL '3 hours', 'Sesión 2: Risotto.'
FROM workshops WHERE slug = 'cocina-italiana' ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, NOW() + INTERVAL '21 days', NOW() + INTERVAL '21 days' + INTERVAL '3 hours', 'Sesión 3: Gnocchi y ragú.'
FROM workshops WHERE slug = 'cocina-italiana' ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, NOW() + INTERVAL '28 days', NOW() + INTERVAL '28 days' + INTERVAL '3 hours', 'Sesión 4: Tiramisú y panna cotta.'
FROM workshops WHERE slug = 'cocina-italiana' ON CONFLICT DO NOTHING;

-- ─── Marcar todos los talleres publicados como aprobados ──────────────────────

UPDATE workshops
SET approval_status = 'approved',
    reviewed_by     = '00000000-0000-0000-0000-000000000099',
    reviewed_at     = NOW()
WHERE status = 'published'
  AND approval_status != 'approved';
