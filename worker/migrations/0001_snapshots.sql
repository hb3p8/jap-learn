CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  device TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  state_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS snapshot_parents (
  child_id TEXT NOT NULL REFERENCES snapshots(id),
  parent_id TEXT NOT NULL REFERENCES snapshots(id),
  PRIMARY KEY (child_id, parent_id),
  CHECK (child_id != parent_id)
);
CREATE INDEX IF NOT EXISTS snapshot_parents_parent ON snapshot_parents(parent_id);
