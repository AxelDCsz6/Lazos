-- ============================================================
-- Sprint 4: Sistema de Riego y Planta
-- ============================================================

-- 1. Añadir fase 'dead' al CHECK de plant_phase
ALTER TABLE lazos DROP CONSTRAINT IF EXISTS lazos_plant_phase_check;
ALTER TABLE lazos ADD CONSTRAINT lazos_plant_phase_check
  CHECK (plant_phase IN ('seed', 'sprout', 'small', 'big', 'flower', 'dead'));

-- 2. Columna para rastrear la última fecha de riego mutuo
--    Usada por el streak job para idempotencia y por el frontend para calcular días sin riego
ALTER TABLE lazos ADD COLUMN IF NOT EXISTS last_mutual_watering_on DATE;
