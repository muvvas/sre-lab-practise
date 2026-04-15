CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO inventory_items (name, category, score)
VALUES
  ('record-1', 'demo', 91),
  ('record-2', 'demo', 88),
  ('record-3', 'demo', 95),
  ('record-4', 'demo', 84),
  ('record-5', 'demo', 79),
  ('record-6', 'demo', 97),
  ('record-7', 'demo', 90),
  ('record-8', 'demo', 86)
ON CONFLICT DO NOTHING;
