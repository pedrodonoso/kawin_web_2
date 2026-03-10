-- Nuevos usuarios
INSERT INTO users (id, email, password_hash, role) VALUES
  ('a1b2c3d4-0001-0001-0001-000000000006', 'jorge@kawin.app',   '$2a$10$Nzrv5VvLqIYfRfI9HmjkHOpfRmYJg6vvFqNQ5g7Y6aM1j3Kcj0fyi', 'instructor'),
  ('a1b2c3d4-0001-0001-0001-000000000007', 'camila@kawin.app',  '$2a$10$Nzrv5VvLqIYfRfI9HmjkHOpfRmYJg6vvFqNQ5g7Y6aM1j3Kcj0fyi', 'instructor'),
  ('a1b2c3d4-0001-0001-0001-000000000008', 'pablo@kawin.app',   '$2a$10$Nzrv5VvLqIYfRfI9HmjkHOpfRmYJg6vvFqNQ5g7Y6aM1j3Kcj0fyi', 'instructor')
ON CONFLICT DO NOTHING;

INSERT INTO profiles (user_id, name, bio, city, country) VALUES
  ('a1b2c3d4-0001-0001-0001-000000000006', 'Jorge Castillo',
   'DJ y productor musical con 15 años en la escena electrónica chilena. Residente del Club Nomade y festival Pulsar. Enseño producción musical con Ableton Live desde 2020.',
   'Santiago', 'Chile'),
  ('a1b2c3d4-0001-0001-0001-000000000007', 'Camila Rojas',
   'Escritora y editora con Magíster en Literatura. Autora de dos libros de cuentos y columnista en The Clinic. Dicto talleres de escritura creativa desde 2019.',
   'Santiago', 'Chile'),
  ('a1b2c3d4-0001-0001-0001-000000000008', 'Pablo Morales',
   'Emprendedor en serie y consultor de negocios. Fundé tres startups y asesoro pymes. Speaker en TEDx Santiago 2023.',
   'Santiago', 'Chile')
ON CONFLICT DO NOTHING;

-- EVENT: Open Mic Jazz
INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT
  'a1b2c3d4-0001-0001-0001-000000000006',
  id,
  'Open Mic Jazz Night — Marzo 2026',
  'open-mic-jazz-marzo-2026',
  'Una noche especial para músicos de jazz de todos los niveles. El formato es simple: te registras, llegas, tocas.

El evento se divide en dos partes. La primera hora es para músicos registrados con turnos de 15 minutos. La segunda es una jam session abierta donde cualquiera puede subir al escenario.

El estudio cuenta con piano de cola Yamaha, batería, amplificadores y sistema de PA profesional. Solo trae tu instrumento principal.

Habrá barra de tragos y snacks. El evento es filmado y las mejores actuaciones se publican en nuestro canal de YouTube con tu permiso.',
  'event', 'in-person', 8000, 'CLP', 40, 'Estudio La Fábrica, Barrio Yungay, Santiago', 'published'
FROM categories WHERE slug = 'musica-danza'
ON CONFLICT DO NOTHING;

-- COURSE: Escritura creativa online
INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT
  'a1b2c3d4-0001-0001-0001-000000000007',
  id,
  'Escritura Creativa: Encuentra tu Voz',
  'escritura-creativa-voz-propia',
  'Un curso de 6 semanas para escritores que quieren encontrar lo que realmente tienen que decir.

Cada semana incluye una clase teórica en video, un ejercicio con entrega obligatoria, retroalimentacion individual y una sesion grupal en vivo los miercoles a las 19:00.

Trabajaremos cuento, cronica y escritura autobiografica como herramientas para explorar tu mundo interior. Cupo maximo 10 personas para garantizar retroalimentacion real.',
  'course', 'online', 120000, 'CLP', 10, NULL, 'published'
FROM categories WHERE slug = 'idiomas'
ON CONFLICT DO NOTHING;

-- WORKSHOP: Macramé
INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT
  'a1b2c3d4-0001-0001-0001-000000000005',
  id,
  'Macramé desde cero: tu primera pieza',
  'macrame-principiantes',
  'El macrame es el arte de anudar cordones para crear piezas decorativas. No necesitas saber tejer ni tener habilidades manuales previas.

En este taller de 3 horas crearás desde cero un colgante de pared de 40 cm con los nudos basicos: nudo cuadrado, nudo de alondra y nudo en espiral.

Todo incluido: cordon de algodon natural, palito de madera, tijeras y los patrones para seguir practicando. Te llevas tu pieza terminada el mismo dia. Maximo 8 personas.',
  'workshop', 'in-person', 28000, 'CLP', 8, 'Taller La Hebra, Nuñoa, Santiago', 'published'
FROM categories WHERE slug = 'artesania'
ON CONFLICT DO NOTHING;

-- CLASS: Producción musical Ableton
INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT
  'a1b2c3d4-0001-0001-0001-000000000006',
  id,
  'Producción Musical con Ableton Live',
  'produccion-musical-ableton',
  'Aprende a producir música electronica profesional desde tu computador con Ableton Live.

Clases semanales online y en vivo. Cada sesion de 2 horas cubre un tema especifico con demostracion en tiempo real.

Temario: interfaz y Session View, sintesis basica, sampleo y beat making, mezcla y efectos, exportacion y lanzamiento en plataformas. Necesitas Ableton Live (version trial gratuita funciona) y audifonos.',
  'class', 'online', 35000, 'CLP', 12, NULL, 'published'
FROM categories WHERE slug = 'tecnologia'
ON CONFLICT DO NOTHING;

-- WORKSHOP: Pitch para emprendedores
INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT
  'a1b2c3d4-0001-0001-0001-000000000008',
  id,
  'Pitch Perfect: Presenta tu idea en 3 minutos',
  'pitch-perfect-emprendedores',
  'Tienes una idea de negocio pero no sabes como presentarla. En 4 horas intensivas aprenderás la estructura de un pitch ganador, como conectar emocionalmente con tu audiencia y practicarás frente al grupo con retroalimentacion real.

Incluye: framework de pitch de 3 minutos, tecnicas de comunicacion no verbal, 3 rondas de practica con feedback grupal y grabacion en video de tu pitch final.

Maximo 10 personas. Al terminar, cada participante tiene un pitch pulido listo para usar.',
  'workshop', 'in-person', 65000, 'CLP', 10, 'WeWork Apoquindo, Las Condes, Santiago', 'published'
FROM categories WHERE slug = 'negocios'
ON CONFLICT DO NOTHING;

-- CLASS: Spanish for beginners
INSERT INTO workshops (instructor_id, category_id, title, slug, description, type, modality, price, currency, capacity, location, status)
SELECT
  'a1b2c3d4-0001-0001-0001-000000000007',
  id,
  'Spanish for Beginners — Chilean Style',
  'spanish-for-beginners-chilean',
  'Learn Spanish with a focus on Chilean Spanish, the most colorful and fast variety of the language.

Classes are online via Zoom, 90 minutes each, in a mix of Spanish and English. Topics: greetings and Chilean slang (po, cachai, al tiro), numbers and transport, food and restaurants, culture and humor, basic grammar without the boring parts.

Maximum 8 students to ensure everyone speaks every class. No prior Spanish required.',
  'class', 'online', 25000, 'CLP', 8, NULL, 'published'
FROM categories WHERE slug = 'idiomas'
ON CONFLICT DO NOTHING;
