-- Миграция: хранение видимого пароля для админ-панели
-- ВАЖНО: это только для внутренней админки, для входа используется password_hash

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_plain TEXT;

COMMENT ON COLUMN users.password_plain IS 'Пароль в открытом виде, только для админ-панели';

