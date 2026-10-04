-- Release notes and dev write-ups, readable by every signed-in brewer and
-- written only by the accounts listed in BREWLAB_ADMIN_EMAILS.
--
-- `changes` is a JSON array of { kind, text } rather than a child table: the
-- list is only ever read and written whole, alongside its entry.

CREATE TABLE IF NOT EXISTS changelog_entries (
  id           TEXT PRIMARY KEY,
  author_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  version      TEXT,
  published_on TEXT NOT NULL,          -- YYYY-MM-DD
  changes      TEXT NOT NULL DEFAULT '[]',
  body         TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_changelog_published ON changelog_entries(published_on);
