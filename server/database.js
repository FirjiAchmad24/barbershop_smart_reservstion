import './config.js'
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'

const serverDir = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(serverDir, 'data')
fs.mkdirSync(dataDir, { recursive: true })

export const databasePath = process.env.DATABASE_PATH || path.join(dataDir, 'barbershop.db')
export const db = new DatabaseSync(databasePath)

db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('customer', 'admin', 'barber')),
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    membership TEXT NOT NULL DEFAULT 'Regular',
    attendance_rate REAL NOT NULL DEFAULT 1,
    specialty TEXT,
    rating REAL,
    shift_start TEXT,
    shift_end TEXT,
    favorite_barber_id INTEGER REFERENCES users(id),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    duration INTEGER NOT NULL CHECK (duration > 0),
    price INTEGER NOT NULL CHECK (price >= 0),
    icon TEXT NOT NULL DEFAULT '✂',
    priority_value REAL NOT NULL DEFAULT .6,
    saw_value INTEGER NOT NULL DEFAULT 2 CHECK (saw_value BETWEEN 1 AND 3),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES users(id),
    service_id TEXT NOT NULL REFERENCES services(id),
    barber_id INTEGER NOT NULL REFERENCES users(id),
    booking_date TEXT NOT NULL,
    booking_time TEXT NOT NULL,
    queue_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Menunggu',
    saw_score REAL NOT NULL,
    member_value REAL NOT NULL,
    service_value REAL NOT NULL,
    punctuality_value REAL NOT NULL,
    member_raw INTEGER NOT NULL DEFAULT 1,
    service_raw INTEGER NOT NULL DEFAULT 2,
    punctuality_raw INTEGER NOT NULL DEFAULT 3,
    checked_in_at TEXT,
    saw_status TEXT NOT NULL DEFAULT 'provisional',
    saw_version INTEGER NOT NULL DEFAULT 2,
    notes TEXT NOT NULL DEFAULT '',
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(booking_date, queue_number)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS unique_active_barber_slot
  ON reservations(barber_id, booking_date, booking_time)
  WHERE status NOT IN ('Dibatalkan', 'No-show');

  CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id INTEGER NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES users(id),
    stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
    comment TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS waitlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES users(id),
    service_id TEXT NOT NULL REFERENCES services(id),
    barber_id INTEGER NOT NULL REFERENCES users(id),
    booking_date TEXT NOT NULL,
    booking_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Menunggu',
    converted_reservation_id INTEGER REFERENCES reservations(id),
    offered_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE UNIQUE INDEX IF NOT EXISTS unique_active_waitlist
  ON waitlist(customer_id, barber_id, booking_date, booking_time)
  WHERE status = 'Menunggu';

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'in-app',
    delivery_status TEXT NOT NULL DEFAULT 'tersimpan',
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`)

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((item) => item.name)
  if (columns.includes(column)) return false
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  return true
}

const serviceSawAdded = ensureColumn('services', 'saw_value', 'INTEGER NOT NULL DEFAULT 2')
const reservationSawAdded = [
  ensureColumn('reservations', 'member_raw', 'INTEGER NOT NULL DEFAULT 1'),
  ensureColumn('reservations', 'service_raw', 'INTEGER NOT NULL DEFAULT 2'),
  ensureColumn('reservations', 'punctuality_raw', 'INTEGER NOT NULL DEFAULT 3'),
  ensureColumn('reservations', 'checked_in_at', 'TEXT'),
  ensureColumn('reservations', 'saw_status', "TEXT NOT NULL DEFAULT 'provisional'"),
  ensureColumn('reservations', 'saw_version', 'INTEGER NOT NULL DEFAULT 1'),
].some(Boolean)

export function localDate(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Makassar' })
}

function seed() {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM users').get().count
  if (existing) return false

  const customerPassword = bcrypt.hashSync('12345678', 10)
  const adminPassword = bcrypt.hashSync('admin123', 10)
  const barberPassword = bcrypt.hashSync('barber123', 10)
  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, role, name, phone, membership, attendance_rate, specialty, rating, shift_start, shift_end)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  db.exec('BEGIN IMMEDIATE')
  try {
    const andry = Number(insertUser.run('pelanggan@email.com', customerPassword, 'customer', 'Andry Arishandy', '0812 3456 7890', 'Gold', .98, null, null, null, null).lastInsertRowid)
    insertUser.run('admin@barbershop.com', adminPassword, 'admin', 'Administrator', '0812 0000 0001', 'Owner', 1, null, null, null, null)
    const budi = Number(insertUser.run('budi@barbershop.com', barberPassword, 'barber', 'Budi', '0812 1000 0001', 'Staff', 1, 'Senior Barber', 4.9, '08:00', '16:00').lastInsertRowid)
    const rama = Number(insertUser.run('rama@barbershop.com', barberPassword, 'barber', 'Rama', '0812 1000 0002', 'Staff', 1, 'Fade Specialist', 4.8, '10:00', '18:00').lastInsertRowid)
    const fajar = Number(insertUser.run('fajar@barbershop.com', barberPassword, 'barber', 'Fajar', '0812 1000 0003', 'Staff', 1, 'Hair Styling', 4.7, '12:00', '20:00').lastInsertRowid)
    const dimas = Number(insertUser.run('dimas@example.com', customerPassword, 'customer', 'Dimas', '', 'Silver', .92, null, null, null, null).lastInsertRowid)
    const risaldi = Number(insertUser.run('risaldi@example.com', customerPassword, 'customer', 'Risaldi', '', 'Regular', .88, null, null, null, null).lastInsertRowid)
    const fahri = Number(insertUser.run('fahri@example.com', customerPassword, 'customer', 'Fahri', '', 'Regular', .82, null, null, null, null).lastInsertRowid)
    const nanda = Number(insertUser.run('nanda@example.com', customerPassword, 'customer', 'Nanda', '', 'Gold', .96, null, null, null, null).lastInsertRowid)
    const akbar = Number(insertUser.run('akbar@example.com', customerPassword, 'customer', 'Akbar', '', 'Regular', .76, null, null, null, null).lastInsertRowid)

    db.prepare('UPDATE users SET favorite_barber_id = ? WHERE id = ?').run(budi, andry)

    const insertService = db.prepare('INSERT INTO services (id, name, description, duration, price, icon, priority_value, saw_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    insertService.run('basic', 'Haircut Basic', 'Potong rambut standar', 25, 25000, '✂', .6, 1)
    insertService.run('beard', 'Haircut + Beard Trim', 'Potong rambut dan rapikan janggut', 40, 40000, '♢', .8, 2)
    insertService.run('premium', 'Premium Grooming', 'Haircut, wash, styling, dan treatment', 55, 65000, '✦', 1, 3)

    const today = localDate()
    const insertReservation = db.prepare(`
      INSERT INTO reservations (customer_id, service_id, barber_id, booking_date, booking_time, queue_number, status, saw_score, member_value, service_value, punctuality_value, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    insertReservation.run(nanda, 'basic', budi, today, '08:40', 'A-05', 'Selesai', .92, 1, .6, .96, new Date().toISOString())
    insertReservation.run(dimas, 'beard', budi, today, '09:20', 'A-06', 'Proses', .88, .8, .8, .92, null)
    insertReservation.run(andry, 'basic', budi, today, '10:00', 'A-07', 'Giliran Anda', .86, 1, .6, .98, null)
    insertReservation.run(risaldi, 'beard', rama, today, '10:40', 'A-08', 'Menunggu', .78, .6, .8, .88, null)
    insertReservation.run(fahri, 'premium', fajar, today, '12:00', 'A-09', 'Menunggu', .72, .6, 1, .82, null)
    insertReservation.run(akbar, 'basic', rama, today, '12:40', 'A-10', 'Menunggu', .61, .6, .6, .76, null)

    const past1 = localDate(-7)
    const past2 = localDate(-13)
    insertReservation.run(andry, 'premium', rama, past1, '10:00', 'A-01', 'Selesai', .91, 1, 1, .98, new Date().toISOString())
    insertReservation.run(andry, 'beard', fajar, past2, '13:00', 'A-01', 'No-show', .81, 1, .8, .7, null)
    db.exec('COMMIT')
    return true
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

const databaseSeeded = seed()

if (serviceSawAdded) db.exec(`
  UPDATE services SET saw_value = CASE
    WHEN id = 'basic' THEN 1
    WHEN id = 'beard' THEN 2
    WHEN id = 'premium' THEN 3
    WHEN priority_value >= .9 THEN 3
    WHEN priority_value >= .7 THEN 2
    ELSE 1 END;
`)

if (reservationSawAdded || databaseSeeded) db.exec(`
  UPDATE reservations SET
    member_raw = CASE WHEN customer_id IN (SELECT id FROM users WHERE membership IN ('Gold', 'Silver', 'Member')) THEN 3 ELSE 1 END,
    service_raw = COALESCE((SELECT saw_value FROM services WHERE services.id = reservations.service_id), 2),
    punctuality_raw = CASE WHEN punctuality_value >= .9 THEN 3 WHEN punctuality_value >= .6 THEN 2 ELSE 1 END,
    checked_in_at = CASE
      WHEN checked_in_at IS NOT NULL THEN checked_in_at
      WHEN status IN ('Proses', 'Selesai') THEN booking_date || 'T' || booking_time || ':00+08:00'
      ELSE NULL END,
    saw_status = CASE WHEN status IN ('Proses', 'Selesai') OR checked_in_at IS NOT NULL THEN 'final' ELSE 'provisional' END;
`)

export function mapUser(row) {
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    name: row.name,
    phone: row.phone,
    membership: row.membership,
    attendanceRate: row.attendance_rate,
    specialty: row.specialty,
    rating: row.rating,
    shiftStart: row.shift_start,
    shiftEnd: row.shift_end,
    favoriteBarberId: row.favorite_barber_id,
  }
}

export function reservationSelect(where = '', order = '') {
  return `
    SELECT r.*, c.name AS customer_name, c.membership,
      s.name AS service_name, s.description AS service_description, s.duration, s.price, s.icon,
      b.name AS barber_name, b.specialty AS barber_specialty,
      rt.stars AS rating_stars, rt.comment AS rating_comment
    FROM reservations r
    JOIN users c ON c.id = r.customer_id
    JOIN services s ON s.id = r.service_id
    JOIN users b ON b.id = r.barber_id
    LEFT JOIN ratings rt ON rt.reservation_id = r.id
    ${where} ${order}
  `
}

export function mapReservation(row) {
  if (!row) return null
  return {
    id: row.id,
    number: row.queue_number,
    name: row.customer_name,
    customerId: row.customer_id,
    membership: row.membership,
    serviceId: row.service_id,
    service: row.service_name,
    serviceDescription: row.service_description,
    duration: row.duration,
    price: row.price,
    icon: row.icon,
    barberId: row.barber_id,
    barber: row.barber_name,
    barberSpecialty: row.barber_specialty,
    date: row.booking_date,
    time: row.booking_time,
    status: row.status,
    score: row.saw_score,
    criteria: {
      member: row.member_value,
      service: row.service_value,
      punctuality: row.punctuality_value,
      memberRaw: row.member_raw,
      serviceRaw: row.service_raw,
      punctualityRaw: row.punctuality_raw,
    },
    checkedInAt: row.checked_in_at,
    sawStatus: row.saw_status,
    sawVersion: row.saw_version,
    notes: row.notes,
    rating: row.rating_stars ? { stars: row.rating_stars, comment: row.rating_comment } : null,
    createdAt: row.created_at,
  }
}
