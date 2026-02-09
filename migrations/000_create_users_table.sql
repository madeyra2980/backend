-- Базовая таблица users (нужно выполнить до 001–005)
-- Создаёт таблицу, если её ещё нет

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  "firstName" VARCHAR(255) NOT NULL DEFAULT 'User',
  "lastName" VARCHAR(255) DEFAULT '',
  account_id VARCHAR(255),
  google_id VARCHAR(255) UNIQUE,
  google_avatar TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

COMMENT ON TABLE users IS 'Пользователи (заказчики и специалисты)';
