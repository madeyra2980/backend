import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../db.js';
import { findByEmail } from '../store/users.js';
import { requireAdmin } from '../middleware/auth.js';
import { CITIES } from '../constants/cities.js';
import { filterAllowedSpecialtyIds, SPECIALTIES } from '../constants/specialties.js';

const router = Router();

// Статичные учётные данные для входа в админ-панель (не из .env и не из БД)
const STATIC_ADMIN_LOGIN = 'komek-2026';
const STATIC_ADMIN_PASSWORD = 'Saken-Madik2002';

const ADMIN_LOGIN = process.env.ADMIN_LOGIN || STATIC_ADMIN_LOGIN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || STATIC_ADMIN_PASSWORD;

// Вход: 1) статичные логин/пароль, 2) env (если заданы), 3) БД (is_admin + password)
router.post('/login', async (req, res) => {
  const { login, password } = req.body || {};

  if (!login || !password) {
    req.session.isAdmin = false;
    return res.status(400).json({ error: 'Укажите логин и пароль' });
  }

  // 1) Статичные учётные данные
  if (login === STATIC_ADMIN_LOGIN && password === STATIC_ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    req.session.adminLoggedInAt = new Date().toISOString();
    return res.json({ ok: true });
  }

  // 2) Переменные окружения (если заданы и отличаются от статичных)
  if (ADMIN_PASSWORD && login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    req.session.adminLoggedInAt = new Date().toISOString();
    return res.json({ ok: true });
  }

  // 3) БД: пользователь с is_admin = true
  try {
    const user = await findByEmail(String(login).trim());
    const isAdmin = user && (user.is_admin === true || user.isAdmin === true);
    if (isAdmin) {
      const hash = user.password_hash || user.passwordHash;
      const plain = user.password_plain || user.passwordPlain;
      const pwd = String(password);
      let match = false;
      if (hash) match = await bcrypt.compare(pwd, hash);
      if (!match && plain && plain === pwd) match = true;
      if (match) {
        req.session.isAdmin = true;
        req.session.adminLoggedInAt = new Date().toISOString();
        return res.json({ ok: true });
      }
    }
  } catch (err) {
    console.error('[Admin] login DB check error:', err.message);
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
        VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9, NOW(), NOW())
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
          VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, NOW(), NOW())
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

// Обновить специалиста
router.put('/specialists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      middleName,
      phone,
      city,
      password,
      specialties,
    } = req.body || {};

    const existingResult = await query(
      `SELECT id FROM users WHERE id = $1 AND is_specialist = true`,
      [id]
    );
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Специалист не найден' });
    }

    const phoneNormalized = phone != null ? String(phone).trim() : null;
    const middleNameValue =
      middleName && String(middleName).trim().length > 0 ? String(middleName).trim() : null;
    const cityValue = city && String(city).trim().length > 0 ? String(city).trim() : null;

    const rawSpecialties = Array.isArray(specialties) ? specialties : [];
    const allowedSpecialties = filterAllowedSpecialtyIds(rawSpecialties);

    let hashedPassword = null;
    if (password != null && String(password).length > 0) {
      hashedPassword = await bcrypt.hash(String(password), 10);
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (firstName != null) {
      fields.push(`"firstName" = $${idx++}`);
      values.push(firstName.trim());
    }
    if (lastName != null) {
      fields.push(`"lastName" = $${idx++}`);
      values.push(lastName.trim());
    }
    if (middleName !== undefined) {
      fields.push(`"middleName" = $${idx++}`);
      values.push(middleNameValue);
    }
    if (phone !== undefined) {
      fields.push(`phone = $${idx++}`);
      values.push(phoneNormalized);
    }
    if (city !== undefined) {
      fields.push(`specialist_city = $${idx++}`);
      values.push(cityValue);
    }
    if (specialties !== undefined) {
      fields.push(`specialist_specialties = $${idx++}`);
      values.push(allowedSpecialties);
    }

    if (hashedPassword) {
      fields.push(`password_hash = $${idx++}`);
      values.push(hashedPassword);
      fields.push(`password_plain = $${idx++}`);
      values.push(String(password));
    }

    fields.push(`"updatedAt" = NOW()`);

    values.push(id);

    await query(
      `UPDATE users
       SET ${fields.join(', ')}
       WHERE id = $${idx}`,
      values
    );

    const updatedResult = await query(
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
       WHERE id = $1`,
      [id]
    );

    const user = updatedResult.rows[0];

    return res.json({
      specialist: {
        id: String(user.id),
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        middleName: user.middleName || '',
        phone: user.phone || '',
        city: user.specialistCity || '',
        rating: user.rating != null ? parseFloat(user.rating) : 0,
        password: user.password_plain || '',
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('Error updating specialist from admin:', err);
    res.status(500).json({ error: 'Ошибка при обновлении специалиста' });
  }
});

// Удалить специалиста
router.delete('/specialists/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM users WHERE id = $1 AND is_specialist = true RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Специалист не найден' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting specialist from admin:', err);
    res.status(500).json({ error: 'Ошибка при удалении специалиста' });
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

// Обновить организацию
router.put('/organizations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, city, address, phone, email } = req.body || {};

    const existing = await query(
      'SELECT id FROM organizations WHERE id = $1',
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Организация не найдена' });
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (name != null) {
      fields.push(`name = $${idx++}`);
      values.push(name.trim());
    }
    if (description !== undefined) {
      const descValue =
        description && String(description).trim().length > 0 ? String(description).trim() : null;
      fields.push(`description = $${idx++}`);
      values.push(descValue);
    }
    if (city !== undefined) {
      const cityValue = city && String(city).trim().length > 0 ? String(city).trim() : null;
      fields.push(`city = $${idx++}`);
      values.push(cityValue);
    }
    if (address !== undefined) {
      const addressValue = address && String(address).trim().length > 0 ? String(address).trim() : null;
      fields.push(`address = $${idx++}`);
      values.push(addressValue);
    }
    if (phone !== undefined) {
      const phoneValue = phone && String(phone).trim().length > 0 ? String(phone).trim() : null;
      fields.push(`phone = $${idx++}`);
      values.push(phoneValue);
    }
    if (email !== undefined) {
      const emailValue = email && String(email).trim().length > 0 ? String(email).trim() : null;
      fields.push(`email = $${idx++}`);
      values.push(emailValue);
    }

    fields.push('updated_at = NOW()');

    values.push(id);

    await query(
      `UPDATE organizations
       SET ${fields.join(', ')}
       WHERE id = $${idx}`,
      values
    );

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
       WHERE id = $1`,
      [id]
    );

    const org = result.rows[0];

    return res.json({
      organization: {
        id: org.id,
        name: org.name || '',
        description: org.description || '',
        city: org.city || '',
        address: org.address || '',
        phone: org.phone || '',
        email: org.email || '',
        createdAt: org.created_at,
        updatedAt: org.updated_at,
      },
    });
  } catch (err) {
    console.error('Error updating organization from admin:', err);
    res.status(500).json({ error: 'Ошибка при обновлении организации' });
  }
});

// Удалить организацию
router.delete('/organizations/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM organizations WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Организация не найдена' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting organization from admin:', err);
    res.status(500).json({ error: 'Ошибка при удалении организации' });
  }
});

export default router;

