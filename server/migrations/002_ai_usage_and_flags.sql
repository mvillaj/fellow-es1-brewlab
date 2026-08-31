-- Metering for the model-backed routes, and a switch to turn them off.
--
-- Without this there is no record of what the two AI endpoints cost, which is
-- the awkward part of an unmetered endpoint: the first signal is the invoice.

CREATE TABLE IF NOT EXISTS ai_usage (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day           TEXT NOT NULL,          -- UTC YYYY-MM-DD, the window caps apply to
  route         TEXT NOT NULL,
  model         TEXT NOT NULL,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd      REAL    NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_day ON ai_usage(user_id, day);
CREATE INDEX IF NOT EXISTS idx_ai_usage_day ON ai_usage(day);

-- Runtime switches. A row here can be flipped over `fly ssh console` without a
-- redeploy, which is the point: `fly secrets set` restarts the machine, and a
-- kill switch that needs a restart is not much of a kill switch.
CREATE TABLE IF NOT EXISTS app_flags (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
