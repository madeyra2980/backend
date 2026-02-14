-- Админ: вход в админ-панель по учётной записи из БД (email + password_hash)
--
-- Как включить вход по БД:
-- 1. Выполните миграцию: node run-migrations.js (или примените этот SQL).
-- 2. Назначьте админа и пароль в БД:
--    UPDATE users SET is_admin = true WHERE email = 'ваш@email.com';
--    Пароль должен быть сохранён как bcrypt-хеш в password_hash (не plain text).
--    Хеш можно сгенерировать в админке при создании специалиста или в Node:
--    require('bcryptjs').hashSync('ваш_пароль', 10)
-- 3. В админ-панели входите: логин = email, пароль = ваш пароль.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN users.is_admin IS 'Доступ в админ-панель по email и паролю из БД';

CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = true;
