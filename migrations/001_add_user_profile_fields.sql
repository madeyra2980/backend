-- Миграция: Добавление полей профиля пользователя
-- Добавляет поля для полного профиля клиента

-- Добавляем номер телефона
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Добавляем фото удостоверения личности (URL или путь к файлу)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS document_photo TEXT;

-- Добавляем рейтинг (по умолчанию 0)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0.0 CHECK (rating >= 0 AND rating <= 5.0);

-- Добавляем ID аккаунта для платежей и мониторинга
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS account_id VARCHAR(255);

-- Создаем индекс для быстрого поиска по account_id
CREATE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id);

-- Комментарии к колонкам
COMMENT ON COLUMN users.phone IS 'Номер телефона клиента';
COMMENT ON COLUMN users.document_photo IS 'URL или путь к фото удостоверения личности';
COMMENT ON COLUMN users.rating IS 'Рейтинг пользователя от 0.0 до 5.0';
COMMENT ON COLUMN users.account_id IS 'ID аккаунта для платежей и мониторинга';
