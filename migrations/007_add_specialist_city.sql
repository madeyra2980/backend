-- Город специалиста: для поиска и отображения
ALTER TABLE users
ADD COLUMN IF NOT EXISTS specialist_city VARCHAR(255);

COMMENT ON COLUMN users.specialist_city IS 'Город специалиста (для поиска и карточки)';
CREATE INDEX IF NOT EXISTS idx_users_specialist_city ON users(specialist_city) WHERE specialist_city IS NOT NULL;
