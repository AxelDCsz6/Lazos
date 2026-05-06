-- Migration 001: add reply_to_id to messages, add reactions table
-- Run against existing database (schema.sql already includes these for fresh installs)

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS reactions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(20) NOT NULL DEFAULT 'heart',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_reaction UNIQUE (message_id, user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_id);
