CREATE TABLE IF NOT EXISTS profiles (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  avatar_url TEXT
);

CREATE TABLE IF NOT EXISTS telemetry (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id       INTEGER NOT NULL REFERENCES profiles(id),
  recorded_at      TEXT NOT NULL,
  pitch            REAL NOT NULL,
  roll             REAL NOT NULL,
  sp               REAL NOT NULL,
  sr               REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_telemetry_profile_time
  ON telemetry(profile_id, recorded_at);
