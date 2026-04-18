-- migrate_002: agregar online_url a workshops
-- Aplica para talleres con modality = 'online' o 'hybrid'
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS online_url TEXT;
