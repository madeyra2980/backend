-- Регистрация по почте и верификация

ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS verification_token TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN users.email_verified IS 'Почта подтверждена по ссылке из письма';
COMMENT ON COLUMN users.verification_token IS 'Токен для ссылки верификации';
COMMENT ON COLUMN users.verification_token_expires IS 'Срок действия токена верификации';

CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token)
WHERE verification_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email) WHERE email_verified = true;
