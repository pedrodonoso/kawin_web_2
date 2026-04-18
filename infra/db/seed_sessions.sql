-- Seed: sessions para talleres no-class (workshops, courses, events)
-- Las clases (type=class) generan sesiones virtuales desde schedules — no se pre-insertan aquí.
-- Depende de: seed_workshops.sql (workshops ya insertados)
-- Los workshop_id se resuelven por slug para evitar UUIDs hardcodeados.

-- ─── Acuarela para principiantes (workshop — fecha única) ─────────────────────

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, '2026-04-19 10:00:00-03', '2026-04-19 13:00:00-03', 'Materiales incluidos. Traer delantal.'
FROM workshops WHERE slug = 'acuarela-principiantes'
ON CONFLICT DO NOTHING;

-- ─── Fotografía callejera (workshop — varias fechas) ─────────────────────────

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, '2026-04-26 10:00:00-03', '2026-04-26 14:00:00-03', 'Traer cámara propia. Punto de encuentro: Metro Baquedano.'
FROM workshops WHERE slug = 'fotografia-callejera'
ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, '2026-05-10 10:00:00-03', '2026-05-10 14:00:00-03', 'Traer cámara propia. Punto de encuentro: Metro Baquedano.'
FROM workshops WHERE slug = 'fotografia-callejera'
ON CONFLICT DO NOTHING;

-- ─── Macramé (workshop — varias fechas) ──────────────────────────────────────

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, '2026-04-12 15:00:00-03', '2026-04-12 18:00:00-03', 'Todos los materiales incluidos.'
FROM workshops WHERE slug = 'macrame-principiantes'
ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, '2026-04-26 15:00:00-03', '2026-04-26 18:00:00-03', 'Todos los materiales incluidos.'
FROM workshops WHERE slug = 'macrame-principiantes'
ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, '2026-05-10 15:00:00-03', '2026-05-10 18:00:00-03', 'Todos los materiales incluidos.'
FROM workshops WHERE slug = 'macrame-principiantes'
ON CONFLICT DO NOTHING;

-- ─── Cerámica a torno (workshop — varias fechas) ─────────────────────────────

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, '2026-04-18 14:00:00-03', '2026-04-18 17:00:00-03', 'Delantal incluido.'
FROM workshops WHERE slug = 'ceramica-torno'
ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, '2026-05-02 14:00:00-03', '2026-05-02 17:00:00-03', 'Delantal incluido.'
FROM workshops WHERE slug = 'ceramica-torno'
ON CONFLICT DO NOTHING;

-- ─── Open Mic Jazz (event — fecha única) ─────────────────────────────────────

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, '2026-04-25 20:00:00-03', '2026-04-25 23:30:00-03', 'Llegar 30 min antes para soundcheck.'
FROM workshops WHERE slug = 'open-mic-jazz-abril-2026'
ON CONFLICT DO NOTHING;

-- ─── Escritura Creativa (course — 6 sesiones semanales) ──────────────────────

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, '2026-04-15 19:00:00-03', '2026-04-15 20:30:00-03', 'Semana 1: El punto de partida — de qué escribes sin darte cuenta.'
FROM workshops WHERE slug = 'escritura-creativa-voz-propia'
ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, '2026-04-22 19:00:00-03', '2026-04-22 20:30:00-03', 'Semana 2: La voz narrativa — quién habla en tus textos.'
FROM workshops WHERE slug = 'escritura-creativa-voz-propia'
ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, '2026-04-29 19:00:00-03', '2026-04-29 20:30:00-03', 'Semana 3: El tiempo y el espacio — dónde ocurre la historia.'
FROM workshops WHERE slug = 'escritura-creativa-voz-propia'
ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, '2026-05-06 19:00:00-03', '2026-05-06 20:30:00-03', 'Semana 4: El conflicto — qué se juega en cada texto.'
FROM workshops WHERE slug = 'escritura-creativa-voz-propia'
ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, '2026-05-13 19:00:00-03', '2026-05-13 20:30:00-03', 'Semana 5: El final — cómo cerrar sin cerrar todo.'
FROM workshops WHERE slug = 'escritura-creativa-voz-propia'
ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, '2026-05-20 19:00:00-03', '2026-05-20 20:30:00-03', 'Semana 6: Lectura pública — compartimos lo que escribimos.'
FROM workshops WHERE slug = 'escritura-creativa-voz-propia'
ON CONFLICT DO NOTHING;

-- ─── Pitch Perfect (workshop — varias fechas) ────────────────────────────────

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, '2026-04-25 09:00:00-03', '2026-04-25 13:00:00-03', 'Trae tu idea o empresa actual.'
FROM workshops WHERE slug = 'pitch-perfect-emprendedores'
ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, '2026-05-23 09:00:00-03', '2026-05-23 13:00:00-03', 'Trae tu idea o empresa actual.'
FROM workshops WHERE slug = 'pitch-perfect-emprendedores'
ON CONFLICT DO NOTHING;

-- ─── Cocina italiana (course — 4 sesiones) ───────────────────────────────────

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, '2026-04-19 10:00:00-03', '2026-04-19 13:00:00-03', 'Sesión 1: Pasta fresca y salsas básicas.'
FROM workshops WHERE slug = 'cocina-italiana'
ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, '2026-04-26 10:00:00-03', '2026-04-26 13:00:00-03', 'Sesión 2: Risotto.'
FROM workshops WHERE slug = 'cocina-italiana'
ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, '2026-05-03 10:00:00-03', '2026-05-03 13:00:00-03', 'Sesión 3: Gnocchi y ragú.'
FROM workshops WHERE slug = 'cocina-italiana'
ON CONFLICT DO NOTHING;

INSERT INTO sessions (workshop_id, starts_at, ends_at, notes)
SELECT id, '2026-05-10 10:00:00-03', '2026-05-10 13:00:00-03', 'Sesión 4: Postres italianos — tiramisú y panna cotta.'
FROM workshops WHERE slug = 'cocina-italiana'
ON CONFLICT DO NOTHING;
