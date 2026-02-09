-- Миграция: Добавление полей местоположения пользователя
-- Добавляет поля для отслеживания геолокации в реальном времени

-- Добавляем широту (latitude)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);

-- Добавляем долготу (longitude)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Добавляем время последнего обновления местоположения
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP;

-- Создаем индекс для быстрого поиска пользователей по местоположению
CREATE INDEX IF NOT EXISTS idx_users_location ON users(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Создаем индекс для поиска активных пользователей (обновили местоположение недавно)
CREATE INDEX IF NOT EXISTS idx_users_location_active ON users(location_updated_at) WHERE location_updated_at IS NOT NULL;

-- Комментарии к колонкам
COMMENT ON COLUMN users.latitude IS 'Широта местоположения пользователя';
COMMENT ON COLUMN users.longitude IS 'Долгота местоположения пользователя';
COMMENT ON COLUMN users.location_updated_at IS 'Время последнего обновления местоположения';
