CREATE TABLE IF NOT EXISTS site_documents (
  id TEXT PRIMARY KEY,
  draft_json TEXT NOT NULL,
  published_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS site_revisions (
  id TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_json TEXT NOT NULL
);
