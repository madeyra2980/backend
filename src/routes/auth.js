import { Router } from 'express';
import passport from 'passport';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { findById } from '../store/users.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
const APP_REDIRECT_SCHEME = process.env.APP_REDIRECT_SCHEME || 'komek';

function isGoogleOAuthConfigured() {
  const id = (process.env.GOOGLE_CLIENT_ID || '').trim();
  const secret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  return Boolean(id && secret);
}

const APP_TOKENS_FILE = path.join(__dirname, '../../data/app-tokens.json');

// Токены для мобильного/десктоп приложения (срок 24 часа), загружаются из файла при старте
const appTokenStore = new Map(); // token -> { userId, expiresAt }

function generateAppToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function persistAppTokens() {
  try {
    const dir = path.dirname(APP_TOKENS_FILE);
    await fs.mkdir(dir, { recursive: true });
    const now = Date.now();
    const entries = [];
    for (const [token, data] of appTokenStore) {
      if (data.expiresAt > now) entries.push({ token, userId: data.userId, expiresAt: data.expiresAt });
    }
    await fs.writeFile(APP_TOKENS_FILE, JSON.stringify(entries), 'utf8');
  } catch (err) {
    console.error('Failed to persist app tokens:', err.message);
  }
}

export async function loadAppTokens() {
  try {
    const data = await fs.readFile(APP_TOKENS_FILE, 'utf8');
    const entries = JSON.parse(data);
    const now = Date.now();
    for (const { token, userId, expiresAt } of entries) {
      if (expiresAt > now) appTokenStore.set(token, { userId, expiresAt });
    }
    if (entries.length > 0) console.log('[Auth] Loaded', appTokenStore.size, 'app token(s) from', APP_TOKENS_FILE);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('[Auth] No app-tokens file yet (will be created on first app login)');
    } else {
      console.error('[Auth] Failed to load app tokens:', err.message);
    }
  }
}

// Запуск входа через Google
// ?app=1 — используется отдельный callback /auth/google/callback/app → редирект в приложение (komek://)
router.get('/google', (req, res, next) => {
  if (!isGoogleOAuthConfigured()) {
    return res.redirect(`${FRONTEND_URL}/?error=oauth_not_configured`);
  }
  if (req.query.app === '1') {
    const port = process.env.PORT || 3000;
    const appBase = (process.env.APP_CALLBACK_BASE_URL || process.env.BACKEND_URL || `http://localhost:${port}`).replace(/\/$/, '');
    console.log('App login: redirect_uri sent to Google =', appBase + '/auth/google/callback/app');
    passport.authenticate('google-app', { scope: ['profile', 'email'] })(req, res, next);
  } else {
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
  }
});

// Callback для веба (редирект на FRONTEND_URL)
router.get('/google/callback', (req, res, next) => {
  if (!isGoogleOAuthConfigured()) {
    return res.redirect(`${FRONTEND_URL}/?error=oauth_not_configured`);
  }
  passport.authenticate('google', {
    session: true,
    failureRedirect: `${FRONTEND_URL}/?error=auth_failed`,
  })(req, res, (err) => {
    if (err) return next(err);
    res.redirect(`${FRONTEND_URL}/?logged=1`);
  });
});

// Callback для приложения → редирект на страницу app-redirect (оттуда открывается приложение)
// В Google Cloud Console добавьте: http://localhost:3000/auth/google/callback/app
router.get('/google/callback/app', (req, res, next) => {
  if (!isGoogleOAuthConfigured()) {
    return res.redirect(`${FRONTEND_URL}/?error=oauth_not_configured`);
  }
  passport.authenticate('google-app', {
    session: true,
    failureRedirect: `${FRONTEND_URL}/?error=auth_failed`,
  })(req, res, async (err) => {
    if (err) return next(err);
    if (!req.user) {
      return res.redirect(`${FRONTEND_URL}/?error=auth_failed`);
    }
    const token = generateAppToken();
    appTokenStore.set(token, {
      userId: req.user.id,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });
    await persistAppTokens();
    console.log('[Auth] App token saved for user', req.user.id, '| store size:', appTokenStore.size);
    res.redirect(`/auth/app-redirect?token=${encodeURIComponent(token)}`);
  });
});

// После OAuth — редирект в приложение: komek:// для нативных или URL для веба (APP_REDIRECT_WEB_URL)
router.get('/app-redirect', (req, res) => {
  const token = String(req.query.token || '').trim();
  if (!token) {
    return res.redirect(`${FRONTEND_URL}/?error=missing_token`);
  }
  const webUrl = process.env.APP_REDIRECT_WEB_URL || '';
  if (webUrl) {
    const base = webUrl.replace(/\/$/, '');
    return res.redirect(`${base}/#/login?token=${encodeURIComponent(token)}`);
  }
  const appUrl = `${APP_REDIRECT_SCHEME}://login?token=${encodeURIComponent(token)}`;
  res.redirect(appUrl);
});

// Выход
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy((err2) => {
      if (err2) return next(err2);
      res.json({ ok: true });
    });
  });
});

// Middleware: установить req.user из Bearer-токена (для приложения Flutter)
export function setUserFromToken(req, res, next) {
  if (req.user) return next();
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
  const token = authHeader.slice(7);
  const entry = appTokenStore.get(token);
  if (!entry || Date.now() > entry.expiresAt) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Auth] Bearer token present, in store:', !!entry, 'expired:', entry ? Date.now() > entry.expiresAt : 'n/a');
    }
    return next();
  }
  findById(entry.userId)
    .then((user) => {
      req.user = user;
      if (process.env.NODE_ENV !== 'production' && (req.path === '/me' || req.originalUrl.includes('/profile/me'))) {
        console.log('[Auth] req.user set for', req.method, req.originalUrl);
      }
      next();
    })
    .catch((err) => {
      console.error('[Auth] findById error:', err.message);
      next();
    });
}

// Текущий пользователь (для SPA или приложения: сессия или Bearer-токен)
router.get('/me', (req, res) => {
  const user = req.user;
  if (user) {
    // PostgreSQL возвращает snake_case, поэтому используем правильные имена
    // Пробуем разные варианты колонок
    const name = user.name || user.full_name || user.firstName || user.first_name || '';
    const firstName = user.firstName || user.first_name || '';
    const lastName = user.lastName || user.last_name || '';
    const createdAt = user.createdAt || user.created_at || null;
    
    // Если name не заполнено, пробуем собрать из firstName и lastName
    const finalName = name || [firstName, lastName].filter(Boolean).join(' ') || user.email?.split('@')[0] || 'User';
    
    // Формируем URL для аватара: приоритет загруженному, если нет - Google аватар
    let avatarUrl = null;
    if (user.avatar) {
      // Загруженный аватар
      if (user.avatar.startsWith('http')) {
        avatarUrl = user.avatar;
      } else {
        avatarUrl = `/uploads/avatars/${user.avatar.split('/').pop()}`;
      }
    } else if (user.google_avatar) {
      // Google аватар как fallback
      avatarUrl = user.google_avatar;
    } else if (user.picture) {
      // Старый picture для обратной совместимости
      avatarUrl = user.picture;
    }
    
    return res.json({ 
      user: { 
        id: String(user.id), 
        email: user.email || '', 
        name: finalName, 
        picture: avatarUrl, // Для обратной совместимости
        avatar: avatarUrl, // Новое поле
        createdAt 
      } 
    });
  }
  res.status(401).json({ user: null });
});

export default router;
