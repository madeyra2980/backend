# Деплой backend на Render

## 1. База данных PostgreSQL

1. Зайди на [render.com](https://render.com) и войди в аккаунт.
2. **Dashboard** → **New** → **PostgreSQL**.
3. Создай базу (имя, регион, план). После создания в разделе **Info** будет **Internal Database URL** и **External Database URL**.
4. Для Web Service используй **Internal Database URL** (если БД и сервис в одном аккаунте) — скопируй и сохрани как `DATABASE_URL`.

## 2. Web Service (backend)

1. **New** → **Web Service**.
2. Подключи репозиторий (GitHub/GitLab). Выбери репозиторий с этим проектом.
3. Настройки:
   - **Name:** например `komek-backend`
   - **Region:** тот же, что у БД
   - **Root Directory:** `backend` (обязательно — проект в подпапке)
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free или выше

4. **Environment** — добавь переменные:

   | Переменная | Описание | Пример |
   |------------|----------|--------|
   | `NODE_ENV` | Режим | `production` |
   | `PORT` | Порт (Render подставляет сам, можно не задавать) | — |
   | `DATABASE_URL` | Строка подключения к PostgreSQL (из шага 1) | `postgres://user:pass@host/db?sslmode=require` |
   | `BACKEND_URL` | Публичный URL твоего сервиса (после первого деплоя) | `https://komek-backend.onrender.com` |
   | `SESSION_SECRET` | Секрет для сессий (придумай длинную строку) | случайная строка |
   | `FRONTEND_URL` | URL клиентского фронтенда | `https://твой-фронт.vercel.app` или свой домен |
   | `ADMIN_FRONTEND_URL` | URL админ-панели | `https://твой-админ.onrender.com` или свой |
   | `SPECIALIST_FRONTEND_URL` | URL фронта специалистов | при наличии |
   | `ADMIN_LOGIN` | Логин админа | свой логин |
   | `ADMIN_PASSWORD` | Пароль админа | свой пароль |
   | `GOOGLE_CLIENT_ID` | Для входа через Google | из Google Console |
   | `GOOGLE_CLIENT_SECRET` | Для входа через Google | из Google Console |

   `BACKEND_URL` лучше задать после первого деплоя: Render покажет URL вида `https://komek-backend.onrender.com` — скопируй его в `BACKEND_URL` и сохрани (при необходимости сделай **Manual Deploy**).

5. **Create Web Service**. Деплой запустится. Дождись зелёного статуса.

## 3. Миграции БД

Миграции не запускаются автоматически. Варианты:

- **Вручную один раз:** на своём компьютере в папке `backend` задай в `.env` только `DATABASE_URL` (External Database URL с Render) и выполни:
  ```bash
  cd backend
  set DATABASE_URL=postgres://...   # Windows
  # или export DATABASE_URL=...     # Linux/macOS
  npm run migrate
  ```
- **Shell на Render:** в Dashboard сервиса → **Shell** → в открывшейся консоли:
  ```bash
  npm run migrate
  ```
  (переменные окружения уже подставлены.)

## 4. Проверка

- Открой `https://твой-сервис.onrender.com/health` — должен вернуться JSON: `{"status":"ok", ...}`.
- Убедись, что в **Environment** указан `BACKEND_URL` с этим же URL (без слэша в конце).

## 5. Google OAuth (если используешь)

В Google Cloud Console в настройках OAuth 2.0 добавь:

- **Authorized redirect URIs:**
  - `https://твой-сервис.onrender.com/auth/google/callback`
  - `https://твой-сервис.onrender.com/auth/google/callback/app`

Сохрани и при необходимости обнови переменные `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET` на Render.

## Заметки

- На бесплатном плане сервис «засыпает» после неактивности; первый запрос может быть медленным.
- Файлы в `uploads/` на Render не сохраняются между деплоями — для загрузок лучше использовать хранилище (S3 и т.п.).
- Логи смотреть в **Logs** в панели сервиса.
