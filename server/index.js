import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = process.env.DATA_DIR || (IS_VERCEL ? path.join(os.tmpdir(), 'hanuman-medical-data') : path.join(__dirname, 'data'));
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT || 5174);
const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-change-before-deployment';

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

let dbCache = null;

function id(prefix = 'id') {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function now() {
  return new Date().toISOString();
}

function today() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function addDays(dateString, days) {
  if (!dateString || !days) return '';
  const d = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + Number(days));
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function phoneKey(value) {
  const digits = cleanPhone(value);
  if (!digits) return '';
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function isoDateFromParts(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return '';
  if (y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return '';
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return '';
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function excelSerialDate(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 20000 || n > 80000) return '';
  const date = new Date(Math.round((n - 25569) * 86400000));
  return isoDateFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function parseDateValue(value) {
  if (value === undefined || value === null || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return isoDateFromParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === 'number') return excelSerialDate(value);

  const text = String(value).trim();
  if (!text) return '';

  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) return isoDateFromParts(match[1], match[2], match[3]);

  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (match) {
    const year = Number(match[3]) < 100 ? Number(match[3]) + 2000 : Number(match[3]);
    return isoDateFromParts(year, match[2], match[1]);
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return isoDateFromParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }
  return '';
}

function parseAmount(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseFollowDays(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 && value < 1000 ? Math.round(value) : 0;
  }
  const text = String(value).trim();
  if (!text) return 0;
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(text) || /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(text)) return 0;
  const match = text.match(/\d+/);
  const n = match ? Number(match[0]) : 0;
  return Number.isFinite(n) && n > 0 && n < 1000 ? Math.round(n) : 0;
}

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const CUSTOMER_IMPORT_ALIASES = {
  name: ['sold to', 'soldto', 'customer name', 'name', 'full name', 'patient', 'cust name', 'customer'],
  mobile: ['pid', 'mobile', 'mobile no', 'mobile number', 'phone', 'contact', 'contact no', 'whatsapp', 'whatsapp no', 'whatsapp number', 'mob', 'cell'],
  lastSaleDate: ['date', 'bill date', 'invoice date', 'billing date', 'sale date', 'last sale date', 'purchase date'],
  billAmount: ['bamount', 'bill amount', 'amount', 'total', 'amt', 'bill amt', 'sale amount', 'purchase amount'],
  followDays: ['follow', 'follow days', 'follow up days', 'followup days', 'follow days initial', 'cycle', 'cycle days', 'days', 'fu days', 'fu'],
  nextFollowUp: ['follow up date', 'followup date', 'follow date', 'next follow up', 'next followup', 'next follow up date', 'next followup date', 'due date'],
  address: ['address', 'addr', 'location'],
  prescription: ['prescription', 'medicine', 'medicines', 'rx', 'drugs'],
  tags: ['tags', 'tag', 'category'],
  notes: ['notes', 'note', 'remarks', 'comment'],
  loyaltyPoints: ['loyalty', 'loyalty points', 'points', 'lp']
};

function importCell(row, field) {
  const aliases = CUSTOMER_IMPORT_ALIASES[field].map(normalizeHeader);
  const entries = Object.entries(row || {}).map(([key, value]) => [normalizeHeader(key), value]);
  const exact = entries.find(([key]) => aliases.includes(key));
  if (exact) return exact[1];
  const loose = entries.find(([key]) => aliases.some((alias) => key.includes(alias)));
  return loose ? loose[1] : '';
}

function buildCustomerImportRow(row, rowNumber) {
  const mobile = cleanPhone(importCell(row, 'mobile'));
  const mobileId = phoneKey(mobile);
  if (!mobileId) return { skip: true, rowNumber, reason: 'Missing PID/mobile number' };

  const lastSaleDate = parseDateValue(importCell(row, 'lastSaleDate')) || today();
  const followDateRaw = importCell(row, 'nextFollowUp');
  const followDaysRaw = importCell(row, 'followDays');
  let followDays = parseFollowDays(followDaysRaw);
  let nextFollowUp = parseDateValue(followDateRaw);

  if (!nextFollowUp && !followDays) nextFollowUp = parseDateValue(followDaysRaw);
  if (!nextFollowUp && followDays) nextFollowUp = addDays(lastSaleDate, followDays);
  if (!nextFollowUp) return { skip: true, rowNumber, mobile, reason: 'Missing follow-up days/date' };

  const name = String(importCell(row, 'name') || '').trim() || `Customer ${mobileId.slice(-4)}`;
  return {
    skip: false,
    rowNumber,
    name,
    mobile,
    mobileId,
    address: String(importCell(row, 'address') || '').trim(),
    tags: String(importCell(row, 'tags') || '').trim(),
    notes: String(importCell(row, 'notes') || '').trim(),
    prescription: String(importCell(row, 'prescription') || '').trim(),
    followDays,
    lastSaleDate,
    billAmount: parseAmount(importCell(row, 'billAmount')),
    nextFollowUp,
    loyaltyPoints: parseAmount(importCell(row, 'loyaltyPoints'))
  };
}

function syncPendingFollowupReminders(db, customer, nextFollowUp) {
  for (const reminder of db.reminders) {
    if (reminder.customerId === customer.id && reminder.status !== 'done' && reminder.type === 'followup') {
      reminder.dueDate = nextFollowUp;
      reminder.message = `Follow-up for ${customer.name}`;
      reminder.updatedAt = now();
    }
  }
}

function safeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function normalizeDb(db) {
  db.users ||= [];
  db.customers ||= [];
  db.products ||= [];
  db.sales ||= [];
  db.reminders ||= [];
  db.calls ||= [];
  db.settings ||= {};
  db.settings.shopName ||= 'Hanuman Medical';
  db.settings.shopPhone ||= '7880042681';
  db.settings.shopAddress ||= 'Medical Store';
  db.settings.currency ||= 'INR';
  return db;
}

async function createSeedDb() {
  return normalizeDb({
    users: [
      {
        id: id('usr'),
        name: 'Admin',
        username: 'admin',
        role: 'admin',
        active: true,
        passwordHash: await bcrypt.hash('admin123', 10),
        createdAt: now()
      }
    ],
    customers: [],
    products: [],
    sales: [],
    reminders: [],
    calls: [],
    settings: {
      shopName: 'Hanuman Medical',
      shopPhone: '7880042681',
      shopAddress: 'Medical Store',
      currency: 'INR'
    }
  });
}

async function readDb() {
  if (dbCache) return dbCache;
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    dbCache = normalizeDb(JSON.parse(raw));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    dbCache = await createSeedDb();
    await writeDb(dbCache);
  }
  return dbCache;
}

async function writeDb(db) {
  normalizeDb(db);
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, DB_FILE);
  dbCache = db;
  return db;
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function createToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Login required' });
    const payload = jwt.verify(token, JWT_SECRET);
    const db = await readDb();
    const user = db.users.find((item) => item.id === payload.sub && item.active !== false);
    if (!user) return res.status(401).json({ error: 'User not found or inactive' });
    req.user = user;
    req.db = db;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please login again.' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

function findById(list, itemId) {
  return list.find((item) => item.id === itemId);
}

function dueFollowups(db) {
  const t = today();
  return db.customers
    .filter((customer) => customer.nextFollowUp && customer.nextFollowUp <= t)
    .map((customer) => ({
      id: customer.id,
      customer,
      type: 'followup',
      dueDate: customer.nextFollowUp,
      message: `Namaste ${customer.name}, Hanuman Medical se. Aapki medicine ka term khatam ho gaya hai. Kya aapko aur medicine chahiye? Hum ready kar denge.`
    }));
}

function summary(db) {
  const t = today();
  const activeSales = db.sales.filter((sale) => !sale.voided);
  const salesToday = activeSales
    .filter((sale) => sale.date === t)
    .reduce((sum, sale) => sum + number(sale.total), 0);
  const lowStock = db.products.filter((product) => number(product.stock) <= number(product.minStock || 0));
  const expiring = db.products.filter((product) => {
    if (!product.expiry) return false;
    const diff = Math.ceil((new Date(`${product.expiry}T00:00:00`) - new Date(`${t}T00:00:00`)) / 86400000);
    return diff >= 0 && diff <= 45;
  });
  const remindersDue = db.reminders.filter((reminder) => reminder.status !== 'done' && reminder.dueDate <= t);
  return {
    date: t,
    customers: db.customers.length,
    products: db.products.length,
    sales: activeSales.length,
    salesToday,
    lowStock,
    expiring,
    remindersDue,
    followupsDue: dueFollowups(db),
    recentSales: db.sales.slice(0, 8),
    recentCalls: db.calls.slice(0, 8)
  };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'Hanuman Medical API' }));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const requestedRole = req.body.role === 'admin' || req.body.role === 'staff' ? req.body.role : '';
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
  const db = await readDb();
  const user = db.users.find((item) => item.username.toLowerCase() === username && item.active !== false);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Wrong username or password' });
  }
  if (requestedRole && user.role !== requestedRole) {
    return res.status(403).json({ error: `Use the ${user.role === 'admin' ? 'Admin' : 'Staff'} Login option for this account` });
  }
  res.json({ token: createToken(user), user: safeUser(user) });
}));

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: safeUser(req.user) }));

app.get('/api/summary', requireAuth, (req, res) => res.json(summary(req.db)));

app.get('/api/settings', requireAuth, (req, res) => res.json(req.db.settings));
app.patch('/api/settings', requireAuth, adminOnly, asyncRoute(async (req, res) => {
  const allowed = ['shopName', 'shopPhone', 'shopAddress', 'currency'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) req.db.settings[key] = String(req.body[key]).trim();
  }
  await writeDb(req.db);
  res.json(req.db.settings);
}));

app.post('/api/settings/reset-data', requireAuth, adminOnly, asyncRoute(async (req, res) => {
  req.db.customers = [];
  req.db.reminders = [];
  req.db.calls = [];
  req.db.products = [];
  req.db.sales = [];
  await writeDb(req.db);
  res.json({ ok: true });
}));

app.get('/api/users', requireAuth, adminOnly, (req, res) => {
  res.json(req.db.users.map(safeUser));
});

app.post('/api/users', requireAuth, adminOnly, asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const role = req.body.role === 'admin' ? 'admin' : 'staff';
  if (!name || !username || password.length < 4) {
    return res.status(400).json({ error: 'Name, username, and password with at least 4 characters are required' });
  }
  if (req.db.users.some((user) => user.username.toLowerCase() === username)) {
    return res.status(409).json({ error: 'Username already exists' });
  }
  const user = {
    id: id('usr'),
    name,
    username,
    role,
    active: true,
    passwordHash: await bcrypt.hash(password, 10),
    createdAt: now()
  };
  req.db.users.push(user);
  await writeDb(req.db);
  res.status(201).json(safeUser(user));
}));

app.patch('/api/users/:id', requireAuth, adminOnly, asyncRoute(async (req, res) => {
  const user = findById(req.db.users, req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (req.body.name !== undefined) user.name = String(req.body.name).trim();
  if (req.body.username !== undefined) {
    const username = String(req.body.username || '').trim().toLowerCase();
    if (!username) return res.status(400).json({ error: 'Username is required' });
    if (req.db.users.some((item) => item.id !== user.id && item.username.toLowerCase() === username)) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    user.username = username;
  }
  if (req.body.role !== undefined) user.role = req.body.role === 'admin' ? 'admin' : 'staff';
  if (req.body.active !== undefined) user.active = Boolean(req.body.active);
  if (req.body.password) {
    if (String(req.body.password).length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
    user.passwordHash = await bcrypt.hash(String(req.body.password), 10);
  }
  user.updatedAt = now();
  await writeDb(req.db);
  res.json(safeUser(user));
}));

app.delete('/api/users/:id', requireAuth, adminOnly, asyncRoute(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });
  req.db.users = req.db.users.filter((user) => user.id !== req.params.id);
  await writeDb(req.db);
  res.status(204).end();
}));

app.get('/api/customers', requireAuth, (req, res) => res.json(req.db.customers));
app.post('/api/customers', requireAuth, adminOnly, asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const mobile = cleanPhone(req.body.mobile);
  if (!name || !mobile) return res.status(400).json({ error: 'Customer name and mobile are required' });
  const followDays = number(req.body.followDays);
  const lastSaleDate = req.body.lastSaleDate || req.body.date || '';
  const customer = {
    id: id('cus'),
    name,
    mobile,
    address: String(req.body.address || '').trim(),
    tags: String(req.body.tags || '').trim(),
    notes: String(req.body.notes || '').trim(),
    prescription: String(req.body.prescription || '').trim(),
    followDays,
    lastSaleDate,
    billAmount: number(req.body.billAmount),
    nextFollowUp: req.body.nextFollowUp || addDays(lastSaleDate, followDays),
    loyaltyPoints: number(req.body.loyaltyPoints),
    createdAt: now(),
    updatedAt: now()
  };
  req.db.customers.unshift(customer);
  await writeDb(req.db);
  res.status(201).json(customer);
}));

app.post('/api/customers/import', requireAuth, adminOnly, asyncRoute(async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ error: 'No customer rows found in the import file' });

  const customerByPhone = new Map();
  for (const customer of req.db.customers) {
    const key = phoneKey(customer.mobile);
    if (key && !customerByPhone.has(key)) customerByPhone.set(key, customer);
  }

  const result = {
    totalRows: rows.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    skippedRows: []
  };

  for (let index = 0; index < rows.length; index += 1) {
    const parsed = buildCustomerImportRow(rows[index], index + 2);
    if (parsed.skip) {
      result.skipped += 1;
      result.skippedRows.push(parsed);
      continue;
    }

    const existing = customerByPhone.get(parsed.mobileId);
    if (existing) {
      if (!existing.nextFollowUp || parsed.nextFollowUp >= existing.nextFollowUp) {
        existing.nextFollowUp = parsed.nextFollowUp;
      }
      if (parsed.followDays) existing.followDays = parsed.followDays;
      existing.updatedAt = now();
      syncPendingFollowupReminders(req.db, existing, existing.nextFollowUp);
      result.updated += 1;
      continue;
    }

    const customer = {
      id: id('cus'),
      name: parsed.name,
      mobile: parsed.mobile,
      address: parsed.address,
      tags: parsed.tags,
      notes: parsed.notes,
      prescription: parsed.prescription,
      followDays: parsed.followDays,
      lastSaleDate: parsed.lastSaleDate,
      billAmount: parsed.billAmount,
      nextFollowUp: parsed.nextFollowUp,
      loyaltyPoints: parsed.loyaltyPoints,
      createdAt: now(),
      updatedAt: now()
    };
    req.db.customers.unshift(customer);
    customerByPhone.set(parsed.mobileId, customer);
    result.imported += 1;
  }

  await writeDb(req.db);
  res.status(201).json(result);
}));

app.patch('/api/customers/:id', requireAuth, adminOnly, asyncRoute(async (req, res) => {
  const customer = findById(req.db.customers, req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const fields = ['name', 'address', 'tags', 'notes', 'prescription', 'lastSaleDate', 'nextFollowUp'];
  for (const field of fields) if (req.body[field] !== undefined) customer[field] = String(req.body[field]).trim();
  if (req.body.mobile !== undefined) customer.mobile = cleanPhone(req.body.mobile);
  if (req.body.followDays !== undefined) customer.followDays = number(req.body.followDays);
  if (req.body.billAmount !== undefined) customer.billAmount = number(req.body.billAmount);
  if (req.body.loyaltyPoints !== undefined) customer.loyaltyPoints = number(req.body.loyaltyPoints);
  if (!customer.nextFollowUp && customer.lastSaleDate && customer.followDays) {
    customer.nextFollowUp = addDays(customer.lastSaleDate, customer.followDays);
  }
  customer.updatedAt = now();
  await writeDb(req.db);
  res.json(customer);
}));

app.delete('/api/customers/:id', requireAuth, adminOnly, asyncRoute(async (req, res) => {
  req.db.customers = req.db.customers.filter((customer) => customer.id !== req.params.id);
  req.db.reminders = req.db.reminders.filter((reminder) => reminder.customerId !== req.params.id);
  req.db.calls = req.db.calls.filter((call) => call.customerId !== req.params.id);
  await writeDb(req.db);
  res.status(204).end();
}));

app.get('/api/products', requireAuth, (req, res) => res.json(req.db.products));
app.post('/api/products', requireAuth, adminOnly, asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name || number(req.body.mrp) <= 0) return res.status(400).json({ error: 'Medicine name and MRP are required' });
  const product = {
    id: id('prd'),
    name,
    batch: String(req.body.batch || '').trim(),
    category: String(req.body.category || '').trim(),
    supplier: String(req.body.supplier || '').trim(),
    stock: number(req.body.stock),
    minStock: number(req.body.minStock),
    mrp: number(req.body.mrp),
    cost: number(req.body.cost),
    expiry: String(req.body.expiry || '').trim(),
    location: String(req.body.location || '').trim(),
    notes: String(req.body.notes || '').trim(),
    createdAt: now(),
    updatedAt: now()
  };
  req.db.products.unshift(product);
  await writeDb(req.db);
  res.status(201).json(product);
}));

app.patch('/api/products/:id', requireAuth, adminOnly, asyncRoute(async (req, res) => {
  const product = findById(req.db.products, req.params.id);
  if (!product) return res.status(404).json({ error: 'Medicine not found' });
  const fields = ['name', 'batch', 'category', 'supplier', 'expiry', 'location', 'notes'];
  for (const field of fields) if (req.body[field] !== undefined) product[field] = String(req.body[field]).trim();
  for (const field of ['stock', 'minStock', 'mrp', 'cost']) if (req.body[field] !== undefined) product[field] = number(req.body[field]);
  product.updatedAt = now();
  await writeDb(req.db);
  res.json(product);
}));

app.delete('/api/products/:id', requireAuth, adminOnly, asyncRoute(async (req, res) => {
  req.db.products = req.db.products.filter((product) => product.id !== req.params.id);
  await writeDb(req.db);
  res.status(204).end();
}));

app.get('/api/reminders', requireAuth, (req, res) => {
  res.json({ reminders: req.db.reminders, followupsDue: dueFollowups(req.db) });
});

app.post('/api/reminders', requireAuth, adminOnly, asyncRoute(async (req, res) => {
  if (!req.body.customerId || !req.body.dueDate || !req.body.message) {
    return res.status(400).json({ error: 'Customer, due date, and message are required' });
  }
  const reminder = {
    id: id('rem'),
    customerId: req.body.customerId,
    type: req.body.type || 'followup',
    message: String(req.body.message).trim(),
    dueDate: String(req.body.dueDate).trim(),
    dueTime: String(req.body.dueTime || '10:00').trim(),
    status: 'pending',
    createdBy: req.user.id,
    createdAt: now()
  };
  req.db.reminders.unshift(reminder);
  await writeDb(req.db);
  res.status(201).json(reminder);
}));

app.post('/api/reminders/:id/done', requireAuth, adminOnly, asyncRoute(async (req, res) => {
  const reminder = findById(req.db.reminders, req.params.id);
  if (!reminder) return res.status(404).json({ error: 'Reminder not found' });
  reminder.status = 'done';
  reminder.doneAt = now();
  reminder.doneBy = req.user.id;
  await writeDb(req.db);
  res.json(reminder);
}));

app.delete('/api/reminders/:id', requireAuth, adminOnly, asyncRoute(async (req, res) => {
  req.db.reminders = req.db.reminders.filter((reminder) => reminder.id !== req.params.id);
  await writeDb(req.db);
  res.status(204).end();
}));

app.get('/api/calls', requireAuth, (req, res) => res.json(req.db.calls));
app.post('/api/calls', requireAuth, adminOnly, asyncRoute(async (req, res) => {
  if (!req.body.customerId) return res.status(400).json({ error: 'Customer is required' });
  const call = {
    id: id('cal'),
    customerId: req.body.customerId,
    date: req.body.date || today(),
    outcome: req.body.outcome || 'contacted',
    duration: number(req.body.duration),
    notes: String(req.body.notes || '').trim(),
    nextAction: String(req.body.nextAction || '').trim(),
    nextActionDate: String(req.body.nextActionDate || '').trim(),
    loggedBy: req.user.name,
    createdAt: now()
  };
  req.db.calls.unshift(call);
  await writeDb(req.db);
  res.status(201).json(call);
}));

app.get('/api/sales', requireAuth, (req, res) => res.json(req.db.sales));
app.post('/api/sales', requireAuth, adminOnly, asyncRoute(async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: 'Invoice needs at least one item' });
  const invoiceItems = [];
  for (const item of items) {
    const product = findById(req.db.products, item.productId);
    const qty = number(item.qty);
    if (!product || qty <= 0) return res.status(400).json({ error: 'Invalid medicine in cart' });
    if (qty > number(product.stock)) return res.status(400).json({ error: `${product.name} has only ${product.stock} in stock` });
    const price = item.price !== undefined ? number(item.price) : number(product.mrp);
    invoiceItems.push({
      productId: product.id,
      name: product.name,
      batch: product.batch,
      expiry: product.expiry,
      qty,
      price,
      lineTotal: qty * price
    });
  }
  const subtotal = invoiceItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const discount = Math.min(number(req.body.discount), subtotal);
  const total = subtotal - discount;
  const invoiceNo = `HM-${today().replaceAll('-', '')}-${String(req.db.sales.length + 1).padStart(4, '0')}`;
  const customer = req.body.customerId ? findById(req.db.customers, req.body.customerId) : null;
  const sale = {
    id: id('sal'),
    invoiceNo,
    date: today(),
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    customerId: customer?.id || '',
    customerName: customer?.name || 'Walk-in Sale',
    items: invoiceItems,
    subtotal,
    discount,
    total,
    paymentMode: req.body.paymentMode || 'cash',
    soldBy: req.user.name,
    createdAt: now()
  };
  for (const item of invoiceItems) {
    const product = findById(req.db.products, item.productId);
    product.stock = number(product.stock) - item.qty;
    product.updatedAt = now();
  }
  if (customer) {
    const followDays = number(req.body.followDays || customer.followDays || 28);
    const nextFollowUp = addDays(sale.date, followDays);
    customer.lastSaleDate = sale.date;
    customer.billAmount = total;
    customer.followDays = followDays;
    customer.nextFollowUp = nextFollowUp;
    customer.loyaltyPoints = number(customer.loyaltyPoints) + Math.floor(total / 100);
    customer.updatedAt = now();
    req.db.reminders.unshift({
      id: id('rem'),
      customerId: customer.id,
      type: 'followup',
      message: `Post-sale follow-up for invoice ${invoiceNo}`,
      dueDate: nextFollowUp,
      dueTime: '10:00',
      status: 'pending',
      createdBy: req.user.id,
      createdAt: now()
    });
  }
  req.db.sales.unshift(sale);
  await writeDb(req.db);
  res.status(201).json(sale);
}));

app.post('/api/sales/:id/void', requireAuth, adminOnly, asyncRoute(async (req, res) => {
  const sale = findById(req.db.sales, req.params.id);
  if (!sale) return res.status(404).json({ error: 'Invoice not found' });
  if (sale.voided) return res.json(sale);
  for (const item of sale.items) {
    const product = findById(req.db.products, item.productId);
    if (product) product.stock = number(product.stock) + number(item.qty);
  }
  sale.voided = true;
  sale.voidedAt = now();
  sale.voidedBy = req.user.name;
  await writeDb(req.db);
  res.json(sale);
}));

app.get('/api/backup', requireAuth, adminOnly, (req, res) => {
  res.setHeader('Content-Disposition', `attachment; filename="hanuman-medical-backup-${today()}.json"`);
  res.json({ ...req.db, exportedAt: now(), app: 'hanuman-medical-web' });
});

app.post('/api/backup/restore', requireAuth, adminOnly, asyncRoute(async (req, res) => {
  const incoming = normalizeDb(req.body);
  if (!Array.isArray(incoming.users) || !incoming.users.length) {
    return res.status(400).json({ error: 'Backup must include users' });
  }
  await writeDb(incoming);
  res.json({ ok: true });
}));

const distDir = path.join(ROOT, 'dist');
app.use(express.static(distDir));
app.get('*', async (_req, res, next) => {
  try {
    await fs.access(path.join(distDir, 'index.html'));
    res.sendFile(path.join(distDir, 'index.html'));
  } catch {
    next();
  }
});

app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message || 'Server error' });
});

export { app, readDb };
export default app;

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
  await readDb();
  app.listen(PORT, () => {
    console.log(`Hanuman Medical API running on http://127.0.0.1:${PORT}`);
  });
}
