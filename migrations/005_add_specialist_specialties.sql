-- Миграция: Специальности специалиста (выбор из списка)
-- Храним массив slug'ов выбранных специальностей

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS specialist_specialties TEXT[] DEFAULT '{}';

COMMENT ON COLUMN users.specialist_specialties IS 'Массив кодов выбранных специальностей (например: santehnik, elektrik)';
