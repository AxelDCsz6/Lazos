-- ============================================================
-- LAZOS — Esquema PostgreSQL
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── USUARIOS ────────────────────────────────────────────────
CREATE TABLE users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username   VARCHAR(30) UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,          -- bcrypt hash
  fcm_token  VARCHAR(255),                   -- Firebase Cloud Messaging
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── LAZOS ───────────────────────────────────────────────────
CREATE TABLE lazos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  streak      INTEGER     NOT NULL DEFAULT 0,
  plant_phase           VARCHAR(10) NOT NULL DEFAULT 'seed'
                        CHECK (plant_phase IN ('seed','sprout','small','big','flower','dead')),
  plant_xp              INTEGER     NOT NULL DEFAULT 0,
  last_mutual_watering_on DATE,
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT different_users CHECK (user1_id <> user2_id),
  CONSTRAINT unique_lazo     UNIQUE (user1_id, user2_id)
);

-- ─── RIEGO DIARIO ────────────────────────────────────────────
CREATE TABLE daily_watering (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lazo_id    UUID NOT NULL REFERENCES lazos(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  watered_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_daily_water UNIQUE (lazo_id, user_id, watered_on)
);

-- ─── MENSAJES ────────────────────────────────────────────────
CREATE TABLE messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lazo_id      UUID        NOT NULL REFERENCES lazos(id) ON DELETE CASCADE,
  sender_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content      TEXT        NOT NULL DEFAULT '',
  type         VARCHAR(10) NOT NULL DEFAULT 'text'
               CHECK (type IN ('text', 'photo', 'video')),
  status       VARCHAR(10) NOT NULL DEFAULT 'sent'
               CHECK (status IN ('sent', 'delivered')),
  reply_to_id  UUID        REFERENCES messages(id) ON DELETE SET NULL,
  media_url    VARCHAR(500),
  media_mime   VARCHAR(50),
  media_size   INTEGER,
  media_width  INTEGER,
  media_height INTEGER,
  media_duration_ms INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── REACCIONES ──────────────────────────────────────────────
CREATE TABLE reactions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(20) NOT NULL DEFAULT 'heart',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_reaction UNIQUE (message_id, user_id, type)
);

-- ─── CÓDIGOS DE INVITACIÓN ───────────────────────────────────
CREATE TABLE invite_codes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code       VARCHAR(8)  UNIQUE NOT NULL,
  creator_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used       BOOLEAN     NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ÍNDICES ─────────────────────────────────────────────────
CREATE INDEX idx_lazos_user1          ON lazos(user1_id);
CREATE INDEX idx_lazos_user2          ON lazos(user2_id);
CREATE INDEX idx_messages_lazo        ON messages(lazo_id, created_at DESC);
CREATE INDEX idx_daily_watering_lazo  ON daily_watering(lazo_id, watered_on);
CREATE INDEX idx_invite_codes_active  ON invite_codes(code) WHERE used = FALSE;
CREATE INDEX idx_reactions_message    ON reactions(message_id);

-- ─── TRIGGER updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_lazos_updated_at
  BEFORE UPDATE ON lazos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
