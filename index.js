import express from 'express';
import session from 'express-session';
import cors from 'cors';
import passport from 'passport';
import dotenv from 'dotenv';
import { configurePassport } from './src/config/passport.js';
import authRoutes, { setUserFromToken, loadAppTokens } from './src/routes/auth.js';
import profileRoutes from './src/routes/profile.js';
import ordersRoutes from './src/routes/orders.js';
import { SPECIALTIES } from './src/constants/specialties.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Загружаем переменные: сначала .env, затем .env.example (если .env нет или в нём нет нужных ключей)
dotenv.config();
if (!process.env.GOOGLE_CLIENT_ID) {
  dotenv.config({ path: path.join(__dirname, '.env.example') });
}

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

// Настройка CORS: React (3001) + backend на Render + любой localhost в dev (Flutter Web и др.)
// Для нативного Flutter (macOS/Android/iOS) CORS не применяется — запросы идут не из браузера
const BACKEND_URL = 'https://backend-2-jbcd.onrender.com';
const corsOrigin = (origin, cb) => {
  if (!origin) return cb(null, true); // запросы без Origin (нативное приложение, Postman)
  if (origin === FRONTEND_URL) return cb(null, origin);
  if (origin === BACKEND_URL) return cb(null, origin);
  if (process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, origin);
  cb(null, false);
};
app.use(
  cors({
    origin: corsOrigin,
    credentials: true, // важно для cookies (React)
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Парсинг JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статическая раздача загруженных файлов
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Настройка сессий
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'kamila1234567890',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS в production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 часа
      sameSite: 'lax',
    },
  })
);

// Инициализация Passport
app.use(passport.initialize());
app.use(passport.session());

// Настройка Passport стратегий
configurePassport();

// Для Flutter: установить req.user из Bearer-токена, если передан
app.use(setUserFromToken);

// Роуты
app.use('/auth', authRoutes);
app.use('/profile', profileRoutes);
app.use('/orders', ordersRoutes);

// Список специальностей (публичный, единый источник с backend)
app.get('/specialties', (req, res) => {
  res.json({ specialties: SPECIALTIES });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// Запуск ngrok (опционально): USE_NGROK=1 и NGROK_AUTHTOKEN в .env
async function startNgrok(port) {
  if (process.env.USE_NGROK !== '1') return null;
  try {
    const ngrok = (await import('@ngrok/ngrok')).default;
    const listener = await ngrok.forward({
      addr: port,
      authtoken_from_env: true,
    });
    const url = listener.url();
    console.log(`🌐 ngrok tunnel: ${url}`);
    console.log(`   (для OAuth добавьте в Google Console: ${url}/auth/google/callback и ${url}/auth/google/callback/app)`);
    return url;
  } catch (e) {
    console.warn('⚠ ngrok не запущен:', e.message);
    console.warn('  Запустите вручную в другом терминале: ngrok http', port);
    return null;
  }
}

// Запуск сервера (сначала загружаем токены приложения из файла)
loadAppTokens().then(() => {
  app.listen(PORT, () => {
    console.log('DB_HOST:', process.env.DB_HOST);
    console.log('DB_PORT:', process.env.DB_PORT);
    console.log('DB_NAME:', process.env.DB_NAME);
    console.log('DB_USER:', process.env.DB_USER);
    console.log('DB_PASSWORD:', process.env.DB_PASSWORD);
    console.log(`🚀 Server running on ${BACKEND_URL}`);
    console.log(`📱 Frontend URL: ${FRONTEND_URL}`);
    console.log(`🔐 Session secret: ${process.env.SESSION_SECRET ? 'configured' : 'using default'}`);
    startNgrok(PORT);
  });
});
