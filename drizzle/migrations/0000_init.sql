CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL,
  password_hash TEXT NOT NULL, auth_source TEXT NOT NULL DEFAULT 'internal', active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE, description TEXT NOT NULL,
  sla_hours INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT, department_id INTEGER NOT NULL REFERENCES departments(id), name TEXT NOT NULL,
  guidance TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_dept_name_uq ON categories(department_id, name);
CREATE TABLE IF NOT EXISTS officers (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  department_id INTEGER NOT NULL REFERENCES departments(id), title TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tracking_number TEXT NOT NULL UNIQUE, year INTEGER NOT NULL, seq INTEGER NOT NULL,
  title TEXT NOT NULL, description TEXT NOT NULL, location TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id), department_id INTEGER NOT NULL REFERENCES departments(id),
  priority TEXT NOT NULL DEFAULT 'medium', status TEXT NOT NULL DEFAULT 'submitted', contact_email TEXT, access_hash TEXT NOT NULL,
  assigned_officer_id INTEGER REFERENCES users(id), escalated INTEGER NOT NULL DEFAULT 0,
  target_date INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, resolved_at INTEGER,
  feedback_score INTEGER, feedback_comment TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS cases_year_seq_uq ON cases(year, seq);
CREATE INDEX IF NOT EXISTS cases_status_idx ON cases(status);
CREATE INDEX IF NOT EXISTS cases_dept_status_idx ON cases(department_id, status);
CREATE INDEX IF NOT EXISTS cases_target_idx ON cases(target_date);
CREATE INDEX IF NOT EXISTS cases_officer_idx ON cases(assigned_officer_id);
CREATE TABLE IF NOT EXISTS timeline_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER NOT NULL REFERENCES cases(id), actor_type TEXT NOT NULL,
  actor_name TEXT NOT NULL, from_status TEXT, to_status TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
  internal INTEGER NOT NULL DEFAULT 0, at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS timeline_case_idx ON timeline_events(case_id);
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER NOT NULL REFERENCES cases(id), key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS attachments_case_idx ON attachments(case_id);
