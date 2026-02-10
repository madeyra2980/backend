-- Миграция: пароли специалистов и отчество

-- Хеш пароля для входа по телефону/паролю
ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_hash TEXT;

COMMENT ON COLUMN users.password_hash IS 'Хеш пароля для входа по номеру телефона';

-- Отчество (middleName) для профиля
ALTER TABLE users
ADD COLUMN IF NOT EXISTS "middleName" VARCHAR(255);

COMMENT ON COLUMN users."middleName" IS 'Отчество пользователя';

