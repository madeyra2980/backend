import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { CITIES } from '../constants/cities.js';
import { filterAllowedSpecialtyIds, SPECIALTIES } from '../constants/specialties.js';

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

// Статичный список городов для админ-панели (как specialties)
router.get('/cities', (req, res) => {
  res.json({ cities: CITIES });
});

// Статичный список специальностей (для чекбоксов в админке)
router.get('/specialties', (req, res) => {
  res.json({ specialties: SPECIALTIES });
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
      password,
      specialties,
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

    // Специальности: фильтруем по разрешённому списку
    const rawSpecialties = Array.isArray(specialties) ? specialties : [];
    const allowedSpecialties = filterAllowedSpecialtyIds(rawSpecialties);

    // Проверяем, нет ли уже пользователя с таким телефоном
    const existing = await query('SELECT id FROM users WHERE phone = $1 LIMIT 1', [phoneNormalized]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Пользователь с таким номером телефона уже существует' });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);

    const id = crypto.randomUUID();
    const cityValue = city && String(city).trim().length > 0 ? String(city).trim() : null;
    const middleNameValue = middleName && String(middleName).trim().length > 0 ? String(middleName).trim() : null;

    let result;
    try {
      // Основной вариант: с колонкой password_plain
      result = await query(
        `INSERT INTO users (
          id,
          "firstName",
          "lastName",
          "middleName",
          phone,
          is_specialist,
          specialist_city,
          specialist_specialties,
          password_hash,
          password_plain,
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, NULL, $2, $3, $4, $5, true, $6, $7, $8, NOW(), NOW())
        RETURNING
          id,
          "firstName",
          "lastName",
          "middleName",
          phone,
          is_specialist as "isSpecialist",
          specialist_city as "specialistCity",
          specialist_specialties as "specialistSpecialties"
        `,
        [
          id,
          firstName.trim(),
          lastName.trim(),
          middleNameValue,
          phoneNormalized,
          cityValue,
          allowedSpecialties,
          hashedPassword,
          String(password),
        ]
      );
    } catch (err) {
      // Если на проде ещё нет колонки password_plain — вставляем без неё
      if (err.code === '42703' || (err.message && String(err.message).includes('password_plain'))) {
        result = await query(
          `INSERT INTO users (
            id,
            "firstName",
            "lastName",
            "middleName",
            phone,
            is_specialist,
            specialist_city,
            specialist_specialties,
            password_hash,
            "createdAt",
            "updatedAt"
          )
          VALUES ($1, NULL, $2, $3, $4, $5, true, $6, $7, NOW(), NOW())
          RETURNING
            id,
            "firstName",
            "lastName",
            "middleName",
            phone,
            is_specialist as "isSpecialist",
            specialist_city as "specialistCity",
            specialist_specialties as "specialistSpecialties"
          `,
          [
            id,
            firstName.trim(),
            lastName.trim(),
            middleNameValue,
            phoneNormalized,
            cityValue,
            allowedSpecialties,
            hashedPassword,
          ]
        );
      } else {
        throw err;
      }
    }

    const user = result.rows[0];

    res.status(201).json({
      specialist: {
        id: String(user.id),
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName || null,
        phone: user.phone,
        city: user.specialistCity || null,
        isSpecialist: !!user.isSpecialist,
        specialties: Array.isArray(user.specialistSpecialties) ? user.specialistSpecialties : allowedSpecialties,
        // Даже если password_plain не сохранился в БД, для админа возвращаем введённый пароль
        plainPassword: String(password),
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

// Список специалистов для админ-панели
router.get('/specialists', async (req, res) => {
  try {
    const result = await query(
      `SELECT
        id,
        "firstName",
        "lastName",
        "middleName",
        phone,
        specialist_city as "specialistCity",
        rating,
        password_plain,
        "createdAt"
      FROM users
      WHERE is_specialist = true
      ORDER BY "createdAt" DESC NULLS LAST, "firstName", "lastName"`,
      []
    );

    const specialists = (result.rows || []).map((row) => ({
      id: String(row.id),
      firstName: row.firstName || '',
      lastName: row.lastName || '',
      middleName: row.middleName || '',
      phone: row.phone || '',
      city: row.specialistCity || '',
      rating: row.rating != null ? parseFloat(row.rating) : 0,
      password: row.password_plain || '',
      createdAt: row.createdAt,
    }));

    res.json({ specialists });
  } catch (err) {
    console.error('Error fetching specialists for admin:', err);
    res.status(500).json({ error: 'Ошибка при загрузке списка специалистов' });
  }
});

// Список организаций для админ-панели
router.get('/organizations', async (req, res) => {
  try {
    const result = await query(
      `SELECT
        id,
        name,
        description,
        city,
        address,
        phone,
        email,
        created_at,
        updated_at
      FROM organizations
      ORDER BY created_at DESC NULLS LAST, name`,
      []
    );

    const organizations = (result.rows || []).map((row) => ({
      id: row.id,
      name: row.name || '',
      description: row.description || '',
      city: row.city || '',
      address: row.address || '',
      phone: row.phone || '',
      email: row.email || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({ organizations });
  } catch (err) {
    console.error('Error fetching organizations for admin:', err);
    res.status(500).json({ error: 'Ошибка при загрузке списка организаций' });
  }
});

export default router;

