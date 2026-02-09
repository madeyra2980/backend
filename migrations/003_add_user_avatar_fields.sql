-- Миграция: Добавление полей аватара пользователя
-- Добавляет поля для хранения аватара пользователя (загруженного и из Google)

-- Добавляем аватар из Google (URL)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS google_avatar TEXT;

-- Добавляем загруженный аватар (путь к файлу)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS avatar TEXT;

-- Комментарии к колонкам
COMMENT ON COLUMN users.google_avatar IS 'URL аватара из Google аккаунта';
COMMENT ON COLUMN users.avatar IS 'Путь к загруженному аватару пользователя';
