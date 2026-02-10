import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// Жёстко заданные доступы администратора
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'komek-2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Saken-Madik2002';

// Вход в админ-панель: создаём сессию администратора
router.post('/login', (req, res) => {
  const { login, password } = req.body || {};

  if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    req.session.adminLoggedInAt = new Date().toISOString();
    return res.json({ ok: true });
  }

  req.session.isAdmin = false;
  return res.status(401).json({ error: 'Неверный логин или пароль администратора' });
});

// Выход из админ-панели
router.post('/logout', (req, res) => {
  if (req.session) {
    req.session.isAdmin = false;
    delete req.session.adminLoggedInAt;
  }
  res.json({ ok: true });
});

// Все роуты ниже — только для администратора
router.use(requireAdmin);

// Создать специалиста вручную из админ-панели
router.post('/specialists', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      middleName, // Отчество
      phone,
      city,
      rating,
      password,
      email,
    } = req.body || {};

    // Базовая валидация
    if (!firstName || !firstName.trim()) {
      return res.status(400).json({ error: 'Поле firstName (Имя) обязательно' });
    }
    if (!lastName || !lastName.trim()) {
      return res.status(400).json({ error: 'Поле lastName (Фамилия) обязательно' });
    }
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ error: 'Поле phone (номер телефона) обязательно' });
    }
    if (!password || String(password).length < 4) {
      return res.status(400).json({ error: 'Пароль обязателен и должен быть не короче 4 символов' });
    }

    const phoneNormalized = String(phone).trim();

    // Проверяем, нет ли уже пользователя с таким телефоном
    const existing = await query('SELECT id FROM users WHERE phone = $1 LIMIT 1', [phoneNormalized]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Пользователь с таким номером телефона уже существует' });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);

    // Рейтинг по умолчанию 0.0, но можно задать руками (0–5)
    let ratingValue = 0.0;
    if (rating !== undefined && rating !== null && rating !== '') {
      const parsed = parseFloat(String(rating).replace(',', '.'));
      if (isNaN(parsed) || parsed < 0 || parsed > 5) {
        return res.status(400).json({ error: 'Рейтинг должен быть числом от 0 до 5' });
      }
      ratingValue = parsed;
    }

    const id = crypto.randomUUID();
    const finalEmail = email && String(email).trim().length > 0 ? String(email).trim() : null;
    const cityValue = city && String(city).trim().length > 0 ? String(city).trim() : null;
    const middleNameValue = middleName && String(middleName).trim().length > 0 ? String(middleName).trim() : null;

    const result = await query(
      `INSERT INTO users (
        id,
        email,
        "firstName",
        "lastName",
        "middleName",
        phone,
        rating,
        is_specialist,
        specialist_city,
        password_hash,
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, NOW(), NOW())
      RETURNING
        id,
        email,
        "firstName",
        "lastName",
        "middleName",
        phone,
        rating,
        is_specialist as "isSpecialist",
        specialist_city as "specialistCity"
      `,
      [
        id,
        finalEmail,
        firstName.trim(),
        lastName.trim(),
        middleNameValue,
        phoneNormalized,
        ratingValue,
        cityValue,
        hashedPassword,
      ]
    );

    const user = result.rows[0];

    res.status(201).json({
      specialist: {
        id: String(user.id),
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName || null,
        phone: user.phone,
        city: user.specialistCity || null,
        rating: user.rating != null ? parseFloat(user.rating) : 0.0,
        email: user.email || null,
        isSpecialist: !!user.isSpecialist,
        avatar: null, // Фото по умолчанию нет
      },
    });
  } catch (err) {
    console.error('Error creating specialist from admin:', err);
    res.status(500).json({ error: 'Ошибка при создании специалиста' });
  }
});

// Создать организацию из админ-панели
router.post('/organizations', async (req, res) => {
  try {
    const {
      name,
      description,
      city,
      address,
      phone,
      email,
    } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Поле name (Название организации) обязательно' });
    }

    const nameValue = name.trim();
    const descValue = description && String(description).trim().length > 0 ? String(description).trim() : null;
    const cityValue = city && String(city).trim().length > 0 ? String(city).trim() : null;
    const addressValue = address && String(address).trim().length > 0 ? String(address).trim() : null;
    const phoneValue = phone && String(phone).trim().length > 0 ? String(phone).trim() : null;
    const emailValue = email && String(email).trim().length > 0 ? String(email).trim() : null;

    const result = await query(
      `INSERT INTO organizations (
        name,
        description,
        city,
        address,
        phone,
        email,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING
        id,
        name,
        description,
        city,
        address,
        phone,
        email,
        created_at,
        updated_at
      `,
      [nameValue, descValue, cityValue, addressValue, phoneValue, emailValue]
    );

    const org = result.rows[0];

    res.status(201).json({
      organization: {
        id: org.id,
        name: org.name,
        description: org.description || null,
        city: org.city || null,
        address: org.address || null,
        phone: org.phone || null,
        email: org.email || null,
        createdAt: org.created_at,
        updatedAt: org.updated_at,
      },
    });
  } catch (err) {
    console.error('Error creating organization from admin:', err);
    res.status(500).json({ error: 'Ошибка при создании организации' });
  }
});

export default router;

