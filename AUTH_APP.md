# Вход для приложения (Flutter macOS/Android/iOS)

## Почему React работает, а Flutter — нет?

**Это не CORS.** Разница в способе авторизации:

| | React (Next.js) | Flutter app |
|---|---|---|
| **Запросы** | Браузер ходит на `localhost:3001/api` → Next.js проксирует на backend (та же «страница», CORS не нужен) | Приложение ходит **напрямую** на `http://localhost:3000` |
| **Авторизация** | **Сессия (cookie)** — после входа через Google backend ставит cookie, браузер отправляет её с каждым запросом | **Bearer-токен** — после входа backend отдаёт токен в ссылке `komek://login?token=...`, приложение сохраняет и шлёт заголовок `Authorization: Bearer <token>` |
| **Где хранится пользователь** | `req.user` из **passport.session()** (cookie) | `req.user` из **setUserFromToken** (токен в памяти + файл `data/app-tokens.json`) |

У Flutter нет доступа к cookie сессии React. Для приложения нужен **отдельный вход через приложение** (кнопка «Войти через Google» в приложении → редирект в браузер → после входа «Открыть в Komek»). Тогда токен попадёт в хранилище backend и в файл.

**CORS:** для нативного Flutter (macOS/Android/iOS) CORS не применяется — запросы идут не из браузера. CORS имеет смысл только для Flutter Web (браузер). В dev backend разрешает любой `localhost:*`.

---

## Настройка OAuth для приложения

Чтобы после входа через Google редирект шёл в приложение (komek://login?token=...):

1. Откройте [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → ваш OAuth 2.0 Client ID (тип **Web application**).
2. В **Authorized redirect URIs** добавьте **только** адреса с валидным доменом (Google не принимает `localhost` и IP вроде `10.0.2.2` — ошибка «must end with a public top-level domain»):
   - **Прод:** `https://api.komek.kz/auth/google/callback/app`
   - **Локальная разработка (ПК и эмулятор):** используйте туннель (ngrok) — см. раздел ниже.
3. Сохраните изменения.
4. Перезапустите backend и снова нажмите «Войти через Google» **в приложении** (не в браузере React).

После этого при входе из приложения Google будет редиректить на `/auth/google/callback/app`, и вы попадёте обратно в приложение с токеном.

---

### Откуда берётся редирект (и как в проде)

**Редирект один** — это всегда адрес **вашего** backend'а, не у каждого пользователя свой.

Backend при старте считает URL так (в `passport.js`):

- **Для приложения (Flutter):**  
  `APP_CALLBACK_BASE_URL` → если нет, то `BACKEND_URL` → если нет, то `http://localhost:PORT`  
  К нему дописывается путь: `.../auth/google/callback/app`.

| Окружение | Что задать | Результат (редирект после Google) |
|-----------|------------|-----------------------------------|
| Локально (ПК / эмулятор) | Туннель ngrok: `APP_CALLBACK_BASE_URL=https://xxxx.ngrok-free.app` | `https://xxxx.ngrok-free.app/auth/google/callback/app` (этот URL добавить в Google Console) |
| **Прод** | На сервере: `BACKEND_URL=https://api.komek.kz` (или `APP_CALLBACK_BASE_URL=...`) | `https://api.komek.kz/auth/google/callback/app` |

В проде вы один раз настраиваете на сервере, например:

```env
BACKEND_URL=https://api.komek.kz
```

Тогда **все** пользователи (и с телефона, и с веба) после нажатия «Разрешить» в Google попадают на этот один и тот же адрес вашего backend'а. Backend там создаёт токен и редиректит в приложение (`komek://login?token=...`) или на веб. В Google Console в **Authorized redirect URIs** для прода должен быть ровно этот URL: `https://api.komek.kz/auth/google/callback/app`.

---

### Ошибка Google: «Invalid Redirect: must end with a public top-level domain»

Google **не принимает** в redirect URI:
- `http://localhost:3000/...`
- `http://10.0.2.2:3000/...` (и любые IP-адреса)

Нужен домен вида `*.com`, `*.io`, `*.ngrok-free.app` и т.п.

**Решение для локальной разработки и Android-эмулятора: туннель ngrok**

1. Установите [ngrok](https://ngrok.com/download) и (по желанию) зарегистрируйтесь для стабильного URL.
2. Запустите backend на порту 3000, затем в отдельном терминале:
   ```bash
   ngrok http 3000
   ```
3. В выводе ngrok будет **HTTPS-URL**, например: `https://abc123.ngrok-free.app`.
4. В **Google Cloud Console** → Credentials → OAuth 2.0 Client ID → **Authorized redirect URIs** добавьте:
   ```text
   https://abc123.ngrok-free.app/auth/google/callback/app
   ```
   (подставьте свой URL из ngrok; без слэша в конце.)
5. В `backend/.env` задайте:
   ```env
   APP_CALLBACK_BASE_URL=https://abc123.ngrok-free.app
   ```
6. Перезапустите backend. В приложении (в т.ч. на эмуляторе) нажмите «Войти через Google».

Приложение по-прежнему может ходить на API по `http://10.0.2.2:3000` (эмулятор) или `http://localhost:3000` (ПК) — в Google и в `APP_CALLBACK_BASE_URL` используется только ngrok-URL для **редиректа после OAuth**. Браузер после входа в Google откроет `https://....ngrok-free.app/auth/google/callback/app`, ngrok перенаправит запрос на ваш backend, и вы попадёте в приложение по ссылке `komek://login?token=...`.

**Примечание:** бесплатный ngrok при первом заходе может показать страницу «Visit Site» — нажмите её один раз. URL при перезапуске ngrok меняется; если используете свой домен в ngrok — он остаётся постоянным.

### Если застряли на странице Google после нажатия «Разрешить»

1. **Redirect URI в Google Console** должен совпадать **буква в букву** с тем, что шлёт backend. При старте backend в логе видно: `OAuth redirect URIs: { ..., callbackURLApp: '...' }`. В [Credentials → OAuth 2.0 Client ID](https://console.cloud.google.com/apis/credentials) в **Authorized redirect URIs** должна быть ровно эта строка (без слэша в конце).
2. **Вход с телефона/другого устройства:** если вы открываете ссылку входа на телефоне, Google редиректит на localhost **телефона**, а не вашего ПК. Задайте в `.env` адрес, доступный с телефона: `APP_CALLBACK_BASE_URL=https://ваш-ngrok-или-ip:3000` и в Google Console добавьте в redirect URIs: `https://ваш-ngrok-или-ip:3000/auth/google/callback/app`.
3. После успешного входа backend откроет страницу «Вход в приложение» с кнопкой **«Открыть приложение»** и возможностью скопировать токен — если приложение не открылось по ссылке `komek://`, нажмите кнопку или вставьте токен вручную.

---

## Если профиль в приложении не грузится

1. **Backend должен быть запущен** до входа: `cd backend && node index.js`
2. Войти нужно **из приложения**: «Войти через Google» → браузер → войти в Google → страница «Вход выполнен» → «Открыть в Komek»
3. После перезапуска backend токены подгружаются из `backend/data/app-tokens.json`. Если файла нет или токен просрочен — нажмите в приложении «Вернуться к входу» и войдите снова.
