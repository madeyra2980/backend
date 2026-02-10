-- Справочник городов Казахстана
CREATE TABLE IF NOT EXISTS cities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  country_code CHAR(2) NOT NULL DEFAULT 'KZ'
);

COMMENT ON TABLE cities IS 'Справочник городов';
COMMENT ON COLUMN cities.name IS 'Название города';
COMMENT ON COLUMN cities.country_code IS 'Код страны (ISO 3166-1 alpha-2)';

-- Статический список городов Казахстана
INSERT INTO cities (name, country_code) VALUES
  ('Алматы', 'KZ'),
  ('Астана', 'KZ'),
  ('Шымкент', 'KZ'),
  ('Караганда', 'KZ'),
  ('Актобе', 'KZ'),
  ('Тараз', 'KZ'),
  ('Павлодар', 'KZ'),
  ('Усть-Каменогорск', 'KZ'),
  ('Семей', 'KZ'),
  ('Атырау', 'KZ'),
  ('Костанай', 'KZ'),
  ('Кызылорда', 'KZ'),
  ('Уральск', 'KZ'),
  ('Петропавловск', 'KZ'),
  ('Туркестан', 'KZ')
ON CONFLICT (name) DO NOTHING;

