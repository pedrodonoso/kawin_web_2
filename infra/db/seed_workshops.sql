-- Seed: workshops + schedules
-- Depende de: init.sql (usuarios y categorías ya insertados)
--
-- Instructores:
--   00000000-0000-0000-0000-000000000001  maria@kawin.app
--   00000000-0000-0000-0000-000000000003  jorge@kawin.app
--   00000000-0000-0000-0000-000000000004  camila@kawin.app
--   00000000-0000-0000-0000-000000000005  pablo@kawin.app

-- ─── Talleres de María (arte y creatividad) ───────────────────────────────────

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000001', id,
  'Acuarela para principiantes', 'acuarela-principiantes',
  'Aprende las bases de la acuarela en un ambiente relajado y creativo. Técnicas húmedo sobre húmedo, degradados y mezcla de colores. Todos los materiales incluidos.',
  'workshop', 'in-person', 25000, 'CLP', 12, 'Barrio Italia, Santiago', 'published'
FROM categories WHERE slug = 'arte-creatividad' ON CONFLICT DO NOTHING;

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000001', id,
  'Fotografía callejera', 'fotografia-callejera',
  'Salimos a las calles de Santiago a capturar el momento decisivo. Aprende composición, luz natural y edición básica. Cámara propia requerida.',
  'workshop', 'in-person', 30000, 'CLP', 6, 'Barrio Italia, Santiago', 'published'
FROM categories WHERE slug = 'fotografia' ON CONFLICT DO NOTHING;

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000001', id,
  'Macramé desde cero: tu primera pieza', 'macrame-principiantes',
  'El macramé es el arte de anudar cordones para crear piezas decorativas. No necesitas habilidades previas. En 3 horas crearás un colgante de pared de 40 cm con los nudos básicos: cuadrado, alondra y espiral. Todo incluido: cordón de algodón natural, palito de madera y patrones. Máximo 8 personas.',
  'workshop', 'in-person', 28000, 'CLP', 8, 'Taller La Hebra, Ñuñoa, Santiago', 'published'
FROM categories WHERE slug = 'artesania' ON CONFLICT DO NOTHING;

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000001', id,
  'Cerámica a torno', 'ceramica-torno',
  'Iníciate en el fascinante mundo de la cerámica con torno eléctrico. Arcilla y materiales incluidos. Te llevas tu pieza del día.',
  'workshop', 'in-person', 55000, 'CLP', 6, 'Ñuñoa, Santiago', 'published'
FROM categories WHERE slug = 'artesania' ON CONFLICT DO NOTHING;

-- ─── Talleres de Jorge (música y tecnología) ──────────────────────────────────

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000003', id,
  'Guitarra flamenca online', 'guitarra-flamenca',
  'Técnica y ritmo flamenco para músicos con conocimientos básicos. Clases en vivo con grabación disponible.',
  'class', 'online', 15000, 'CLP', NULL, NULL, 'published'
FROM categories WHERE slug = 'musica-danza' ON CONFLICT DO NOTHING;

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000003', id,
  'Open Mic Jazz Night — Abril 2026', 'open-mic-jazz-abril-2026',
  'Una noche especial para músicos de jazz de todos los niveles. La primera hora es para músicos registrados con turnos de 15 minutos. La segunda es una jam session abierta. El estudio cuenta con piano de cola Yamaha, batería, amplificadores y PA profesional. Solo trae tu instrumento.',
  'event', 'in-person', 8000, 'CLP', 40, 'Estudio La Fábrica, Barrio Yungay, Santiago', 'published'
FROM categories WHERE slug = 'musica-danza' ON CONFLICT DO NOTHING;

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000003', id,
  'Producción Musical con Ableton Live', 'produccion-musical-ableton',
  'Aprende a producir música electrónica profesional desde tu computador. Clases semanales online en vivo de 2 horas. Temario: interfaz y Session View, síntesis básica, sampleo y beat making, mezcla y efectos, exportación. Necesitas Ableton Live (versión trial gratuita funciona).',
  'class', 'online', 35000, 'CLP', 12, NULL, 'published'
FROM categories WHERE slug = 'tecnologia' ON CONFLICT DO NOTHING;

-- ─── Talleres de Camila (escritura e idiomas) ─────────────────────────────────

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000004', id,
  'Escritura Creativa: Encuentra tu Voz', 'escritura-creativa-voz-propia',
  'Un curso de 6 semanas para escritores que quieren encontrar lo que realmente tienen que decir. Cada semana incluye clase teórica, ejercicio con entrega, retroalimentación individual y sesión grupal en vivo los miércoles a las 19:00. Trabajaremos cuento, crónica y escritura autobiográfica. Cupo máximo 10 personas.',
  'course', 'online', 120000, 'CLP', 10, NULL, 'published'
FROM categories WHERE slug = 'idiomas' ON CONFLICT DO NOTHING;

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000004', id,
  'Spanish for Beginners — Chilean Style', 'spanish-for-beginners-chilean',
  'Learn Spanish with a focus on Chilean Spanish — the most colorful and fast variety. Classes online via Zoom, 90 minutes each. Topics: greetings and Chilean slang, numbers and transport, food and restaurants, culture and humor. Maximum 8 students.',
  'class', 'online', 25000, 'CLP', 8, NULL, 'published'
FROM categories WHERE slug = 'idiomas' ON CONFLICT DO NOTHING;

-- ─── Talleres de Pablo (negocios) ────────────────────────────────────────────

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000005', id,
  'Pitch Perfect: Presenta tu idea en 3 minutos', 'pitch-perfect-emprendedores',
  'Tienes una idea de negocio pero no sabes cómo presentarla. En 4 horas intensivas aprenderás la estructura de un pitch ganador, cómo conectar emocionalmente con tu audiencia y practicarás frente al grupo. Incluye: framework de 3 minutos, comunicación no verbal, 3 rondas de práctica y grabación del pitch final. Máximo 10 personas.',
  'workshop', 'in-person', 65000, 'CLP', 10, 'WeWork Apoquindo, Las Condes, Santiago', 'published'
FROM categories WHERE slug = 'negocios' ON CONFLICT DO NOTHING;

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000001', id,
  'Cocina italiana desde cero', 'cocina-italiana',
  'Pasta, risotto y salsas auténticas con ingredientes locales. Un viaje gastronómico sin salir de Santiago.',
  'course', 'in-person', 45000, 'CLP', 8, 'Providencia, Santiago', 'published'
FROM categories WHERE slug = 'cocina-gastronomia' ON CONFLICT DO NOTHING;

INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT '00000000-0000-0000-0000-000000000001', id,
  'Yoga restaurativo', 'yoga-restaurativo',
  'Práctica suave enfocada en la recuperación y el bienestar profundo. Ideal para reducir el estrés y reconectar con el cuerpo.',
  'class', 'hybrid', 12000, 'CLP', 15, 'Las Condes, Santiago', 'published'
FROM categories WHERE slug = 'bienestar-salud' ON CONFLICT DO NOTHING;

-- ─── Schedules (solo para talleres tipo class) ────────────────────────────────

-- Guitarra flamenca: martes y jueves 19:00, 90 min
INSERT INTO schedules (workshop_id, days_of_week, time_start, duration_min, valid_from)
SELECT id, ARRAY[2, 4], '19:00', 90, CURRENT_DATE
FROM workshops WHERE slug = 'guitarra-flamenca'
ON CONFLICT DO NOTHING;

-- Producción Ableton: lunes 20:00, 120 min
INSERT INTO schedules (workshop_id, days_of_week, time_start, duration_min, valid_from)
SELECT id, ARRAY[1], '20:00', 120, CURRENT_DATE
FROM workshops WHERE slug = 'produccion-musical-ableton'
ON CONFLICT DO NOTHING;

-- Spanish for Beginners: miércoles 18:00, 90 min
INSERT INTO schedules (workshop_id, days_of_week, time_start, duration_min, valid_from)
SELECT id, ARRAY[3], '18:00', 90, CURRENT_DATE
FROM workshops WHERE slug = 'spanish-for-beginners-chilean'
ON CONFLICT DO NOTHING;

-- Yoga restaurativo: lunes, miércoles y viernes 08:00, 60 min
INSERT INTO schedules (workshop_id, days_of_week, time_start, duration_min, valid_from)
SELECT id, ARRAY[1, 3, 5], '08:00', 60, CURRENT_DATE
FROM workshops WHERE slug = 'yoga-restaurativo'
ON CONFLICT DO NOTHING;
