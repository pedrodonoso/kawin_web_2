-- Migration 004: insert admin user + profile (idempotent)
-- Email: admin@kawin.app  |  Password: test1234

INSERT INTO users (id, email, password_hash, role)
VALUES (
    '00000000-0000-0000-0000-000000000099',
    'admin@kawin.app',
    '$2a$10$8lU7Wn25aYsRnBURkQB.Q.ZeOcDorE1W9h3RSMxwuMAoW.xlV/rhW',
    'admin'
)
ON CONFLICT DO NOTHING;

INSERT INTO profiles (user_id, name, bio, city, country)
VALUES (
    '00000000-0000-0000-0000-000000000099',
    'Administrador Kawin',
    'Equipo de revisión y moderación de Kawin.',
    'Santiago',
    'Chile'
)
ON CONFLICT DO NOTHING;
