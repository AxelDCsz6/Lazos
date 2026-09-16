-- Migración: mensajes de sistema (riego, avisos de racha)
-- Aplicar sobre una DB existente con schema.sql / migración 001 ya cargados.

-- Permitir tipo 'system' en la columna type.
-- Nota: el nombre del constraint inline en schema.sql es el auto-generado
-- 'messages_type_check' (verificado con \d messages). DROP ... IF EXISTS
-- tolera instalaciones donde difiera el nombre (en ese caso quedará el
-- constraint viejo, que hay que dropear a mano).
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_type_check
  CHECK (type IN ('text', 'photo', 'video', 'system'));
