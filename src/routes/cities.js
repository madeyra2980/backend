import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Простой список городов для фильтров (специалисты, организации и т.п.)
// Берём уникальные города из users.specialist_city и organizations.city
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `
      SELECT DISTINCT TRIM(city) AS city
      FROM (
        SELECT specialist_city AS city
        FROM users
        WHERE is_specialist = true
          AND specialist_city IS NOT NULL
          AND TRIM(specialist_city) <> ''
        UNION
        SELECT city
        FROM organizations
        WHERE city IS NOT NULL
          AND TRIM(city) <> ''
      ) AS all_cities
      WHERE TRIM(city) <> ''
      ORDER BY city
      `,
      []
    );

    const cities = (result.rows || [])
      .map((row) => (row.city || '').trim())
      .filter((c) => c.length > 0);

    res.json({ cities });
  } catch (err) {
    // Если таблицы/колонки ещё не созданы — просто отдаём пустой список, без 500
    if (err.code === '42703' || (err.message && String(err.message).includes('does not exist'))) {
      return res.json({ cities: [] });
    }
    console.error('Error fetching cities:', err);
    res.status(500).json({ error: 'Ошибка при загрузке списка городов' });
  }
});

export default router;

