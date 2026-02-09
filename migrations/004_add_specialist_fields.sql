-- Миграция: Добавление полей «специалист» для пользователя
-- Один пользователь может быть и заказчиком, и специалистом

-- Флаг: пользователь зарегистрирован как специалист (предлагает услуги)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_specialist BOOLEAN DEFAULT false;

-- Краткое описание/услуги специалиста (показ заказчикам)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS specialist_bio TEXT;

-- Время, когда пользователь подал заявку / стал специалистом
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS specialist_since TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_is_specialist ON users(is_specialist) WHERE is_specialist = true;

COMMENT ON COLUMN users.is_specialist IS 'Пользователь зарегистрирован как специалист и может оказывать услуги';
COMMENT ON COLUMN users.specialist_bio IS 'Описание услуг / о себе для карточки специалиста';
COMMENT ON COLUMN users.specialist_since IS 'Дата регистрации в качестве специалиста';
