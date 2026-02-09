export function requireAuth(req, res, next) {
  if (req.user) return next();
  res.status(401).json({ error: 'Требуется авторизация' });
}
