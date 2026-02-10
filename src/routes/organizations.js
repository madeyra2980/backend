import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Список организаций (опционально по городу: ?city=...)
router.get('/', requireAuth, async (req, res) => {
  try {
    const city = typeof req.query.city === 'string' ? req.query.city.trim() : null;
    const hasCityFilter = city && city.length > 0;
    const result = hasCityFilter
      ? await query(
          `SELECT id, name, description, city, address, phone, email, created_at, updated_at
           FROM organizations
           WHERE (city IS NOT NULL AND LOWER(TRIM(city)) = LOWER($1))
           ORDER BY name`,
          [city]
        )
      : await query(
          `SELECT id, name, description, city, address, phone, email, created_at, updated_at
           FROM organizations
           ORDER BY name`,
          []
        );
    const organizations = (result.rows || []).map((row) => ({
      id: row.id,
      name: row.name ?? '',
      description: row.description ?? null,
      city: row.city ?? null,
      address: row.address ?? null,
      phone: row.phone ?? null,
      email: row.email ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    res.json({ organizations, count: organizations.length });
  } catch (err) {
    if (err.code === '42703' || (err.message && String(err.message).includes('does not exist'))) {
      return res.json({ organizations: [], count: 0 });
    }
    console.error('Error fetching organizations:', err);
    res.status(500).json({ error: 'Ошибка при загрузке списка организаций' });
  }
});

// Одна организация по id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT id, name, description, city, address, phone, email, created_at, updated_at
       FROM organizations WHERE id = $1`,
      [id]
    );
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Организация не найдена' });
    }
    const row = result.rows[0];
    res.json({
      organization: {
        id: row.id,
        name: row.name ?? '',
        description: row.description ?? null,
        city: row.city ?? null,
        address: row.address ?? null,
        phone: row.phone ?? null,
        email: row.email ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    console.error('Error fetching organization:', err);
    res.status(500).json({ error: 'Ошибка при загрузке организации' });
  }
});

export default router;
