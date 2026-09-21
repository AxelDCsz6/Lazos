-- 003: Cache de previews de links (OpenGraph) para mensajes con URLs.
-- Llena el endpoint GET /api/lazos/:id/link-preview.
CREATE TABLE IF NOT EXISTS link_previews (
  url          TEXT PRIMARY KEY,
  title        TEXT,
  description  TEXT,
  image_url    TEXT,
  site_name    TEXT,
  resolved_url TEXT,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
