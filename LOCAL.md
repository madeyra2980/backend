# Запуск backend локально (Node.js)

## 1. Переменные окружения

В папке `backend` создайте или отредактируйте файл `.env`.

**Локальная разработка (без Render):**
```env
# База данных (PostgreSQL локально)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=komek_db
DB_USER=komek_user
DB_PASSWORD=komek-123

# Сервер
PORT=3000
FRONTEND_URL=http://localhost:3001
SESSION_SECRET=ваш-секрет-минимум-20-символов

# Опционально: Google OAuth (если нужен вход через Google)
# GOOGLE_CLIENT_ID=...
# GOOGLE_CLIENT_SECRET=...
```

Если используете Render (production), задайте только `DATABASE_URL` — тогда подключение пойдёт по нему с SSL.

## 2. PostgreSQL

- Установите [PostgreSQL](https://www.postgresql.org/download/windows/).
- Создайте базу и пользователя:
  - В pgAdmin или `psql`: создать БД `komek_db`, пользователя `komek_user` с паролем `komek-123`, выдать права на БД.

## 3. Миграции

```bash
cd backend
npm run migrate
```

## 4. Запуск

```bash
cd backend
npm run dev
```

Сервер будет на **http://localhost:3000**.

- Проверка: http://localhost:3000/health → `{"status":"ok",...}`
- Специальности: http://localhost:3000/specialties

## 5. Flutter

В приложении Flutter укажите базовый URL API: **http://localhost:3000** (или ваш IP в сети для эмулятора/телефона). Конфиг обычно в `lib/api/api_client.dart` или через переменные окружения.
