-- Migración: soporte de fotos y videos en mensajes
-- Aplicar sobre una DB existente con schema.sql v1 ya cargado.

-- Permitir tipo 'video' en la columna type
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_type_check
  CHECK (type IN ('text', 'photo', 'video'));

-- content ya no es obligatorio (fotos/videos pueden no llevar caption)
ALTER TABLE messages ALTER COLUMN content SET DEFAULT '';
ALTER TABLE messages ALTER COLUMN content DROP NOT NULL;

-- Columnas de metadatos del media
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url    VARCHAR(500);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_mime   VARCHAR(50);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_size   INTEGER;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_width  INTEGER;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_height INTEGER;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_duration_ms INTEGER;
