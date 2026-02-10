export function requireAuth(req, res, next) {
  if (req.user) return next();
  res.status(401).json({ error: 'Требуется авторизация' });
}

// Админ-доступ по сессии (ставится после /admin/login)
export function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.status(401).json({ error: 'Требуется админ-доступ' });
}
