import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { db, localDate, mapReservation, mapUser, reservationSelect } from './database.js'
import { memberRawValue, normalizeSawAlternatives, punctualityRawValue } from './saw.js'

const app = express()
const port = Number(process.env.PORT || 3001)
const jwtSecret = process.env.JWT_SECRET || 'development-only-change-this-secret'
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) throw new Error('JWT_SECRET wajib diatur pada environment production.')
const cookieName = 'barbershop_session'
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const eventClients = new Set()

app.use(helmet({ contentSecurityPolicy: false }))
app.use(express.json({ limit: '200kb' }))
app.use(cookieParser())

function signSession(user) {
  return jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: '12h', issuer: 'pangkas-rambut' })
}

function readSession(req) {
  const token = req.cookies[cookieName]
  if (!token) return null
  try {
    return jwt.verify(token, jwtSecret, { issuer: 'pangkas-rambut' })
  } catch {
    return null
  }
}

function auth(req, res, next) {
  const session = readSession(req)
  if (!session) return res.status(401).json({ message: 'Silakan masuk terlebih dahulu.' })
  const row = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(Number(session.sub))
  if (!row) return res.status(401).json({ message: 'Sesi tidak valid.' })
  req.user = mapUser(row)
  next()
}

function allow(...roles) {
  return (req, res, next) => roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ message: 'Anda tidak memiliki akses untuk tindakan ini.' })
}

function cleanText(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '')
}

function isTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')
}

function toMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function localTime() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Makassar',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const hour = parts.find((part) => part.type === 'hour')?.value || '00'
  const minute = parts.find((part) => part.type === 'minute')?.value || '00'
  return `${hour}:${minute}`
}

function broadcast(type, payload = {}) {
  const event = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`
  for (const client of eventClients) client.write(event)
}

function createNotification(userId, title, message) {
  const user = db.prepare('SELECT phone FROM users WHERE id = ?').get(userId)
  const channel = process.env.WHATSAPP_WEBHOOK_URL && user?.phone ? 'whatsapp+in-app' : 'in-app'
  const result = db.prepare(`INSERT INTO notifications (user_id, title, message, channel) VALUES (?, ?, ?, ?)`).run(userId, title, message, channel)
  const notificationId = Number(result.lastInsertRowid)
  broadcast('notification-created', { userId, notificationId })
  if (process.env.WHATSAPP_WEBHOOK_URL && user?.phone) {
    fetch(process.env.WHATSAPP_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(process.env.WHATSAPP_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.WHATSAPP_WEBHOOK_TOKEN}` } : {}) },
      body: JSON.stringify({ to: user.phone, title, message }),
    }).then((response) => {
      db.prepare('UPDATE notifications SET delivery_status = ? WHERE id = ?').run(response.ok ? 'terkirim' : 'gagal', notificationId)
    }).catch(() => db.prepare('UPDATE notifications SET delivery_status = ? WHERE id = ?').run('gagal', notificationId))
  }
  return notificationId
}

function nextQueueNumber(date) {
  const maximum = db.prepare(`SELECT COALESCE(MAX(CAST(SUBSTR(queue_number, 3) AS INTEGER)), 0) AS number FROM reservations WHERE booking_date = ?`).get(date).number
  return `A-${String(maximum + 1).padStart(2, '0')}`
}

function waitlistSelect(where = '', order = 'ORDER BY w.created_at ASC') {
  return `
    SELECT w.*, c.name AS customer_name, c.phone, c.membership,
      s.name AS service_name, s.duration, s.price, s.saw_value,
      b.name AS barber_name
    FROM waitlist w
    JOIN users c ON c.id = w.customer_id
    JOIN services s ON s.id = w.service_id
    JOIN users b ON b.id = w.barber_id
    ${where} ${order}
  `
}

function waitlistActivationState(row) {
  if (row.status !== 'Menunggu') return { canActivate: false, activationMessage: 'Waitlist sudah tidak aktif.' }

  const today = localDate()
  if (row.booking_date < today || (row.booking_date === today && row.booking_time <= localTime())) {
    return { canActivate: false, activationMessage: 'Waktu slot sudah lewat.' }
  }

  const start = toMinutes(row.booking_time)
  const existingSlots = db.prepare(`
    SELECT r.booking_time, s.duration
    FROM reservations r
    JOIN services s ON s.id = r.service_id
    WHERE r.barber_id = ? AND r.booking_date = ? AND r.status NOT IN ('Dibatalkan', 'No-show')
  `).all(row.barber_id, row.booking_date)
  const occupied = existingSlots.some((item) => start < toMinutes(item.booking_time) + item.duration && start + row.duration > toMinutes(item.booking_time))
  if (occupied) return { canActivate: false, activationMessage: 'Slot masih penuh. Waitlist akan aktif otomatis setelah slot dibatalkan atau pelanggan no-show.' }

  const duplicate = db.prepare(`
    SELECT id FROM reservations
    WHERE customer_id = ? AND booking_date = ? AND status NOT IN ('Dibatalkan', 'No-show', 'Selesai')
    LIMIT 1
  `).get(row.customer_id, row.booking_date)
  if (duplicate) return { canActivate: false, activationMessage: 'Pelanggan masih mempunyai reservasi aktif pada tanggal tersebut.' }

  return { canActivate: true, activationMessage: 'Slot tersedia dan waitlist siap diaktifkan.' }
}

function expirePastWaitlists() {
  const today = localDate()
  db.prepare(`
    UPDATE waitlist
    SET status = 'Kedaluwarsa', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'Menunggu'
      AND (booking_date < ? OR (booking_date = ? AND booking_time <= ?))
  `).run(today, today, localTime())
}

function mapWaitlist(row, { includeActivation = false } = {}) {
  const mapped = {
    id: row.id,
    customerId: row.customer_id,
    customer: row.customer_name,
    membership: row.membership,
    serviceId: row.service_id,
    service: row.service_name,
    barberId: row.barber_id,
    barber: row.barber_name,
    date: row.booking_date,
    time: row.booking_time,
    status: row.status,
    convertedReservationId: row.converted_reservation_id,
    createdAt: row.created_at,
  }
  return includeActivation ? { ...mapped, ...waitlistActivationState(row) } : mapped
}

function serviceRows() {
  return db.prepare('SELECT id, name, description, duration, price, icon, saw_value AS sawValue, active FROM services WHERE active = 1 ORDER BY price').all()
}

function barberRows(includeInactive = false) {
  return db.prepare(`
    SELECT id, name, email, phone, membership, specialty, rating, shift_start, shift_end, active
    FROM users WHERE role = 'barber' ${includeInactive ? '' : 'AND active = 1'} ORDER BY id
  `).all().map((row) => ({
    id: row.id,
    name: row.name,
    specialty: row.specialty,
    rating: row.rating,
    shift: `${row.shift_start} – ${row.shift_end}`,
    shiftStart: row.shift_start,
    shiftEnd: row.shift_end,
    initial: row.name.charAt(0).toUpperCase(),
    email: row.email,
    phone: row.phone,
    membership: row.membership,
    active: row.active,
  }))
}

function bookingDates() {
  return [0, 1, 2].map((offset) => {
    const value = localDate(offset)
    const date = new Date(`${value}T00:00:00+08:00`)
    const shortDate = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', timeZone: 'Asia/Makassar' }).format(date).replace('.', '')
    const full = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Makassar' }).format(date)
    return {
      id: value,
      day: offset === 0 ? 'Hari ini' : offset === 1 ? 'Besok' : new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Makassar' }).format(date),
      date: shortDate,
      full,
    }
  })
}

function getReservation(id) {
  const row = db.prepare(reservationSelect('WHERE r.id = ?')).get(Number(id))
  return mapReservation(row)
}

function recalculateSaw(date, { includeCompleted = false } = {}) {
  const statusFilter = includeCompleted
    ? "status NOT IN ('No-show', 'Dibatalkan')"
    : "status NOT IN ('Selesai', 'No-show', 'Dibatalkan')"
  db.prepare(`
    UPDATE reservations SET
      member_raw = CASE WHEN customer_id IN (SELECT id FROM users WHERE membership IN ('Gold', 'Silver', 'Member')) THEN 3 ELSE 1 END,
      service_raw = COALESCE((SELECT saw_value FROM services WHERE services.id = reservations.service_id), 2)
    WHERE booking_date = ? AND ${statusFilter}
  `).run(date)
  const alternatives = db.prepare(`
    SELECT id, member_raw AS memberRaw, service_raw AS serviceRaw,
      punctuality_raw AS punctualityRaw, booking_time || created_at AS tieBreaker
    FROM reservations
    WHERE booking_date = ? AND ${statusFilter}
  `).all(date)
  const calculated = normalizeSawAlternatives(alternatives)
  const update = db.prepare(`
    UPDATE reservations SET member_value = ?, service_value = ?, punctuality_value = ?, saw_score = ?, saw_version = 2, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  for (const item of calculated) update.run(item.normalized.member, item.normalized.service, item.normalized.punctuality, item.score, item.id)
  return calculated
}

function activateWaitlist(waitlistId) {
  expirePastWaitlists()
  const entry = db.prepare(waitlistSelect('WHERE w.id = ?')).get(Number(waitlistId))
  if (!entry || entry.status !== 'Menunggu') throw Object.assign(new Error('Waitlist tidak aktif atau waktu slot sudah lewat.'), { status: 409 })
  const activation = waitlistActivationState(entry)
  if (!activation.canActivate) throw Object.assign(new Error(activation.activationMessage), { status: 409 })
  const activeBarber = db.prepare(`SELECT id FROM reservations WHERE barber_id = ? AND booking_date = ? AND status IN ('Proses', 'Giliran Anda') LIMIT 1`).get(entry.barber_id, entry.booking_date)
  const status = activeBarber ? 'Menunggu' : 'Giliran Anda'
  let reservationId
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = db.prepare(`
      INSERT INTO reservations (customer_id, service_id, barber_id, booking_date, booking_time, queue_number, status, saw_score, member_value, service_value, punctuality_value, member_raw, service_raw, punctuality_raw, saw_status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, ?, 3, 'provisional', 'Dikonversi dari waitlist digital')
    `).run(entry.customer_id, entry.service_id, entry.barber_id, entry.booking_date, entry.booking_time, nextQueueNumber(entry.booking_date), status, memberRawValue(entry.membership), entry.saw_value)
    reservationId = Number(result.lastInsertRowid)
    db.prepare(`UPDATE waitlist SET status = 'Dikonversi', converted_reservation_id = ?, offered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(reservationId, entry.id)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  recalculateSaw(entry.booking_date)
  const reservation = getReservation(reservationId)
  createNotification(entry.customer_id, 'Slot waitlist tersedia', `Waitlist Anda berhasil menjadi reservasi ${reservation.number} pada ${entry.booking_date} pukul ${entry.booking_time} WITA.`)
  broadcast('queue-updated', { reservationId, action: 'waitlist-converted' })
  broadcast('waitlist-updated', { waitlistId: entry.id })
  return reservation
}

function promoteWaitlistForSlot(barberId, date, time, freedDuration) {
  const start = toMinutes(time)
  const candidates = db.prepare(waitlistSelect("WHERE w.barber_id = ? AND w.booking_date = ? AND w.status = 'Menunggu'", 'ORDER BY w.created_at')).all(barberId, date)
  for (const entry of candidates) {
    const waitlistStart = toMinutes(entry.booking_time)
    const overlaps = waitlistStart < start + freedDuration && waitlistStart + entry.duration > start
    if (!overlaps) continue
    try { return activateWaitlist(entry.id) } catch { /* coba kandidat berikutnya */ }
  }
  return null
}

for (const row of db.prepare(`SELECT DISTINCT booking_date FROM reservations WHERE saw_version < 2 AND status NOT IN ('No-show', 'Dibatalkan')`).all()) {
  recalculateSaw(row.booking_date, { includeCompleted: true })
}
for (const row of db.prepare(`SELECT DISTINCT booking_date FROM reservations WHERE status NOT IN ('Selesai', 'No-show', 'Dibatalkan')`).all()) {
  recalculateSaw(row.booking_date)
}

function getQueue(date = localDate()) {
  recalculateSaw(date)
  return db.prepare(reservationSelect(
    'WHERE r.booking_date = ? AND r.status != \'Dibatalkan\'',
    `ORDER BY CASE r.status WHEN 'Selesai' THEN 1 WHEN 'Proses' THEN 2 WHEN 'Giliran Anda' THEN 3 ELSE 4 END,
      r.saw_score DESC, r.booking_time ASC, r.created_at ASC`,
  )).all(date).map(mapReservation)
}

function promoteNext(barberId, date) {
  recalculateSaw(date)
  const active = db.prepare(`SELECT id FROM reservations WHERE barber_id = ? AND booking_date = ? AND status IN ('Proses', 'Giliran Anda') LIMIT 1`).get(barberId, date)
  if (active) return
  const next = db.prepare(`SELECT id, customer_id, queue_number FROM reservations WHERE barber_id = ? AND booking_date = ? AND status = 'Menunggu' ORDER BY saw_score DESC, booking_time ASC, created_at ASC LIMIT 1`).get(barberId, date)
  if (next) {
    db.prepare(`UPDATE reservations SET status = 'Giliran Anda', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(next.id)
    createNotification(next.customer_id, 'Giliran Anda', `Nomor antrian ${next.queue_number} sudah dipanggil. Silakan menuju area pelayanan.`)
  }
}

const loginLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false })

app.get('/api/health', (_req, res) => res.json({ ok: true, database: 'connected', date: localDate() }))

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const email = cleanText(req.body.email, 150).toLowerCase()
  const password = typeof req.body.password === 'string' ? req.body.password : ''
  if (!email || !password) return res.status(400).json({ message: 'Email dan password wajib diisi.' })
  const row = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email)
  if (!row || !(await bcrypt.compare(password, row.password_hash))) return res.status(401).json({ message: 'Email atau password salah.' })
  const user = mapUser(row)
  res.cookie(cookieName, signSession(user), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  })
  res.json({ user })
})

app.get('/api/auth/me', (req, res) => {
  const session = readSession(req)
  if (!session) return res.json({ user: null })
  const row = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(Number(session.sub))
  res.json({ user: mapUser(row) })
})

app.post('/api/auth/register', loginLimiter, async (req, res) => {
  const name = cleanText(req.body.name, 100)
  const email = cleanText(req.body.email, 150).toLowerCase()
  const phone = cleanText(req.body.phone, 30)
  const password = typeof req.body.password === 'string' ? req.body.password : ''
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return res.status(400).json({ message: 'Nama, email valid, dan password minimal 8 karakter wajib diisi.' })
  try {
    const result = db.prepare(`INSERT INTO users (email, password_hash, role, name, phone, membership, attendance_rate) VALUES (?, ?, 'customer', ?, ?, 'Regular', 1)`).run(email, await bcrypt.hash(password, 10), name, phone)
    const user = mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(Number(result.lastInsertRowid)))
    res.cookie(cookieName, signSession(user), { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 12 * 60 * 60 * 1000, path: '/' })
    broadcast('master-updated', { type: 'Member' })
    res.status(201).json({ user })
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return res.status(409).json({ message: 'Email sudah terdaftar.' })
    throw error
  }
})
app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(cookieName, { httpOnly: true, sameSite: 'strict', path: '/' })
  res.status(204).end()
})

app.get('/api/bootstrap', auth, (_req, res) => {
  res.json({ services: serviceRows(), barbers: barberRows(), bookingDates: bookingDates() })
})

app.get('/api/availability', auth, (req, res) => {
  const barberId = Number(req.query.barberId)
  const date = cleanText(req.query.date, 10)
  const serviceId = cleanText(req.query.serviceId, 50)
  if (!barberId || !isDate(date) || !serviceId) return res.status(400).json({ message: 'Layanan, barber, dan tanggal tidak valid.' })
  const barber = db.prepare(`SELECT shift_start, shift_end FROM users WHERE id = ? AND role = 'barber' AND active = 1`).get(barberId)
  const service = db.prepare('SELECT duration FROM services WHERE id = ? AND active = 1').get(serviceId)
  if (!barber || !service) return res.status(404).json({ message: 'Layanan atau barber tidak ditemukan.' })
  const slots = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00']
    .filter((time) => toMinutes(time) >= toMinutes(barber.shift_start) && toMinutes(time) + service.duration <= toMinutes(barber.shift_end))
  const occupied = db.prepare(`SELECT r.booking_time, s.duration FROM reservations r JOIN services s ON s.id = r.service_id WHERE r.barber_id = ? AND r.booking_date = ? AND r.status NOT IN ('Dibatalkan', 'No-show')`).all(barberId, date)
  res.json({ slots: slots.map((time) => {
    const start = toMinutes(time)
    const end = start + service.duration
    const overlaps = occupied.some((item) => start < toMinutes(item.booking_time) + item.duration && end > toMinutes(item.booking_time))
    return { time, available: !overlaps }
  }) })
})

app.get('/api/events', auth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
  res.write(`event: connected\ndata: {"ok":true}\n\n`)
  eventClients.add(res)
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000)
  req.on('close', () => { clearInterval(heartbeat); eventClients.delete(res) })
})

app.get('/api/notifications', auth, (req, res) => {
  const notifications = db.prepare(`SELECT id, title, message, channel, delivery_status AS deliveryStatus, read_at AS readAt, created_at AS createdAt FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`).all(req.user.id)
  res.json({ notifications, unread: notifications.filter((item) => !item.readAt).length })
})

app.patch('/api/notifications/:id/read', auth, (req, res) => {
  db.prepare(`UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id = ? AND user_id = ?`).run(Number(req.params.id), req.user.id)
  res.status(204).end()
})

app.get('/api/customer/dashboard', auth, allow('customer'), (req, res) => {
  const active = db.prepare(reservationSelect(
    `WHERE r.customer_id = ? AND r.status NOT IN ('Selesai', 'No-show', 'Dibatalkan')`,
    'ORDER BY r.booking_date, r.booking_time LIMIT 1',
  )).get(req.user.id)
  const total = db.prepare('SELECT COUNT(*) AS count FROM reservations WHERE customer_id = ?').get(req.user.id).count
  res.json({ activeReservation: mapReservation(active), totalReservations: total, availableBarbers: barberRows().length })
})

app.get('/api/customer/reservations', auth, allow('customer'), (req, res) => {
  const rows = db.prepare(reservationSelect('WHERE r.customer_id = ?', 'ORDER BY r.booking_date DESC, r.booking_time DESC')).all(req.user.id)
  res.json({ reservations: rows.map(mapReservation) })
})

app.get('/api/customer/waitlist', auth, allow('customer'), (req, res) => {
  expirePastWaitlists()
  const rows = db.prepare(waitlistSelect('WHERE w.customer_id = ?', 'ORDER BY w.created_at DESC')).all(req.user.id)
  res.json({ waitlist: rows.map(mapWaitlist) })
})

app.post('/api/customer/waitlist', auth, allow('customer'), (req, res) => {
  const serviceId = cleanText(req.body.serviceId, 50)
  const barberId = Number(req.body.barberId)
  const date = cleanText(req.body.date, 10)
  const time = cleanText(req.body.time, 5)
  if (!serviceId || !barberId || !isDate(date) || !isTime(time) || date < localDate()) return res.status(400).json({ message: 'Data waitlist tidak valid.' })
  const service = db.prepare('SELECT * FROM services WHERE id = ? AND active = 1').get(serviceId)
  const barber = db.prepare(`SELECT * FROM users WHERE id = ? AND role = 'barber' AND active = 1`).get(barberId)
  if (!service || !barber || time < barber.shift_start || time >= barber.shift_end) return res.status(404).json({ message: 'Layanan, barber, atau jam tidak tersedia.' })
  const activeReservation = db.prepare(`SELECT id FROM reservations WHERE customer_id = ? AND booking_date = ? AND status NOT IN ('Dibatalkan', 'No-show', 'Selesai')`).get(req.user.id, date)
  if (activeReservation) return res.status(409).json({ message: 'Anda sudah memiliki reservasi aktif pada tanggal tersebut.' })
  const existingSlots = db.prepare(`SELECT r.booking_time, s.duration FROM reservations r JOIN services s ON s.id = r.service_id WHERE r.barber_id = ? AND r.booking_date = ? AND r.status NOT IN ('Dibatalkan', 'No-show')`).all(barberId, date)
  const start = toMinutes(time)
  const occupied = existingSlots.some((item) => start < toMinutes(item.booking_time) + item.duration && start + service.duration > toMinutes(item.booking_time))
  if (!occupied) return res.status(409).json({ message: 'Slot masih tersedia. Silakan buat reservasi langsung.' })
  try {
    const result = db.prepare(`INSERT INTO waitlist (customer_id, service_id, barber_id, booking_date, booking_time) VALUES (?, ?, ?, ?, ?)`).run(req.user.id, serviceId, barberId, date, time)
    const entry = mapWaitlist(db.prepare(waitlistSelect('WHERE w.id = ?')).get(Number(result.lastInsertRowid)))
    createNotification(req.user.id, 'Waitlist digital aktif', `Anda masuk waitlist ${entry.service} pada ${entry.date} pukul ${entry.time} WITA.`)
    broadcast('waitlist-updated', { waitlistId: entry.id })
    res.status(201).json({ entry })
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return res.status(409).json({ message: 'Anda sudah berada pada waitlist slot tersebut.' })
    throw error
  }
})

app.get('/api/queue', auth, (req, res) => {
  const date = isDate(req.query.date) ? req.query.date : localDate()
  res.json({ queue: getQueue(date), date })
})

app.post('/api/customer/reservations', auth, allow('customer'), (req, res) => {
  const serviceId = cleanText(req.body.serviceId, 50)
  const barberId = Number(req.body.barberId)
  const date = cleanText(req.body.date, 10)
  const time = cleanText(req.body.time, 5)
  const notes = cleanText(req.body.notes, 300)
  if (!serviceId || !barberId || !isDate(date) || !isTime(time)) return res.status(400).json({ message: 'Data reservasi belum lengkap.' })
  if (date < localDate()) return res.status(400).json({ message: 'Tanggal reservasi tidak boleh di masa lalu.' })
  const service = db.prepare('SELECT * FROM services WHERE id = ? AND active = 1').get(serviceId)
  const barber = db.prepare(`SELECT * FROM users WHERE id = ? AND role = 'barber' AND active = 1`).get(barberId)
  if (!service || !barber) return res.status(404).json({ message: 'Layanan atau barber tidak ditemukan.' })
  if (time < barber.shift_start || time >= barber.shift_end) return res.status(400).json({ message: 'Jam berada di luar shift barber.' })
  const existingSlots = db.prepare(`SELECT r.id, r.booking_time, s.duration FROM reservations r JOIN services s ON s.id = r.service_id WHERE r.barber_id = ? AND r.booking_date = ? AND r.status NOT IN ('Dibatalkan', 'No-show')`).all(barberId, date)
  const start = toMinutes(time)
  const occupied = existingSlots.find((item) => start < toMinutes(item.booking_time) + item.duration && start + service.duration > toMinutes(item.booking_time))
  if (occupied) return res.status(409).json({ message: 'Slot tersebut baru saja dipesan. Silakan pilih jam lain.' })
  const duplicate = db.prepare(`SELECT id FROM reservations WHERE customer_id = ? AND booking_date = ? AND status NOT IN ('Dibatalkan', 'No-show', 'Selesai')`).get(req.user.id, date)
  if (duplicate) return res.status(409).json({ message: 'Anda sudah memiliki reservasi aktif pada tanggal tersebut.' })

  const memberRaw = memberRawValue(req.user.membership)
  const serviceRaw = Number(service.saw_value || 2)
  const punctualityRaw = 3
  const max = db.prepare(`SELECT COALESCE(MAX(CAST(SUBSTR(queue_number, 3) AS INTEGER)), 0) AS number FROM reservations WHERE booking_date = ?`).get(date).number
  const queueNumber = `A-${String(max + 1).padStart(2, '0')}`
  const activeBarber = db.prepare(`SELECT id FROM reservations WHERE barber_id = ? AND booking_date = ? AND status IN ('Proses', 'Giliran Anda') LIMIT 1`).get(barberId, date)
  const status = activeBarber ? 'Menunggu' : 'Giliran Anda'
  try {
    const result = db.prepare(`
      INSERT INTO reservations (customer_id, service_id, barber_id, booking_date, booking_time, queue_number, status, saw_score, member_value, service_value, punctuality_value, member_raw, service_raw, punctuality_raw, saw_status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, ?, ?, 'provisional', ?)
    `).run(req.user.id, serviceId, barberId, date, time, queueNumber, status, memberRaw, serviceRaw, punctualityRaw, notes)
    recalculateSaw(date)
    const reservation = getReservation(Number(result.lastInsertRowid))
    createNotification(req.user.id, 'Reservasi berhasil', `Reservasi ${reservation.number} untuk ${reservation.service} pada ${reservation.date} pukul ${reservation.time} WITA berhasil dibuat.`)
    broadcast('queue-updated', { reservationId: reservation.id, action: 'created' })
    res.status(201).json({ reservation })
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return res.status(409).json({ message: 'Slot sudah terisi. Silakan pilih jam lain.' })
    throw error
  }
})

app.patch('/api/customer/reservations/:id/cancel', auth, allow('customer'), (req, res) => {
  const result = db.prepare(`UPDATE reservations SET status = 'Dibatalkan', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND customer_id = ? AND status IN ('Menunggu', 'Giliran Anda')`).run(Number(req.params.id), req.user.id)
  if (!result.changes) return res.status(409).json({ message: 'Reservasi ini tidak dapat dibatalkan.' })
  const reservation = getReservation(req.params.id)
  promoteNext(reservation.barberId, reservation.date)
  promoteWaitlistForSlot(reservation.barberId, reservation.date, reservation.time, reservation.duration)
  broadcast('queue-updated', { reservationId: reservation.id, action: 'cancelled' })
  res.json({ reservation: getReservation(req.params.id) })
})

app.post('/api/customer/ratings', auth, allow('customer'), (req, res) => {
  const reservationId = Number(req.body.reservationId)
  const stars = Number(req.body.stars)
  const comment = cleanText(req.body.comment, 500)
  if (!reservationId || !Number.isInteger(stars) || stars < 1 || stars > 5) return res.status(400).json({ message: 'Rating harus antara 1 sampai 5.' })
  const reservation = db.prepare(`SELECT id, barber_id FROM reservations WHERE id = ? AND customer_id = ? AND status = 'Selesai'`).get(reservationId, req.user.id)
  if (!reservation) return res.status(404).json({ message: 'Reservasi selesai tidak ditemukan.' })
  try {
    db.prepare('INSERT INTO ratings (reservation_id, customer_id, stars, comment) VALUES (?, ?, ?, ?)').run(reservationId, req.user.id, stars, comment)
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return res.status(409).json({ message: 'Reservasi ini sudah diberi rating.' })
    throw error
  }
  const average = db.prepare(`SELECT AVG(rt.stars) AS average FROM ratings rt JOIN reservations r ON r.id = rt.reservation_id WHERE r.barber_id = ?`).get(reservation.barber_id).average
  if (average) db.prepare('UPDATE users SET rating = ? WHERE id = ?').run(Number(average.toFixed(1)), reservation.barber_id)
  broadcast('rating-created', { reservationId })
  res.status(201).json({ rating: { stars, comment } })
})

app.put('/api/customer/profile', auth, allow('customer'), (req, res) => {
  const name = cleanText(req.body.name, 100)
  const phone = cleanText(req.body.phone, 30)
  const favoriteBarberId = req.body.favoriteBarberId ? Number(req.body.favoriteBarberId) : null
  if (name.length < 2) return res.status(400).json({ message: 'Nama minimal 2 karakter.' })
  if (favoriteBarberId && !db.prepare(`SELECT id FROM users WHERE id = ? AND role = 'barber' AND active = 1`).get(favoriteBarberId)) return res.status(400).json({ message: 'Barber favorit tidak valid.' })
  db.prepare('UPDATE users SET name = ?, phone = ?, favorite_barber_id = ? WHERE id = ?').run(name, phone, favoriteBarberId, req.user.id)
  res.json({ user: mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) })
})

app.patch('/api/reservations/:id/check-in', auth, allow('admin', 'barber'), (req, res) => {
  const id = Number(req.params.id)
  const current = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id)
  if (!current) return res.status(404).json({ message: 'Reservasi tidak ditemukan.' })
  if (req.user.role === 'barber' && current.barber_id !== req.user.id) return res.status(403).json({ message: 'Reservasi ini bukan antrian Anda.' })
  if (['Selesai', 'No-show', 'Dibatalkan'].includes(current.status)) return res.status(409).json({ message: 'Reservasi ini tidak dapat melakukan check-in.' })
  if (current.booking_date !== localDate()) return res.status(409).json({ message: 'Check-in hanya dapat dilakukan pada tanggal reservasi.' })
  const actualTime = isTime(req.body.arrivalTime)
    ? req.body.arrivalTime
    : new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hour12: false })
  const punctualityRaw = punctualityRawValue(current.booking_time, actualTime)
  const checkedInAt = `${current.booking_date}T${actualTime}:00+08:00`
  db.prepare(`UPDATE reservations SET checked_in_at = ?, punctuality_raw = ?, saw_status = 'final', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(checkedInAt, punctualityRaw, id)
  recalculateSaw(current.booking_date)
  broadcast('queue-updated', { reservationId: id, action: 'check-in', punctualityRaw })
  res.json({ reservation: getReservation(id), queue: getQueue(current.booking_date) })
})

app.get('/api/admin/dashboard', auth, allow('admin'), (_req, res) => {
  const today = localDate()
  const summary = db.prepare(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN status = 'Menunggu' THEN 1 ELSE 0 END) AS waiting,
      SUM(CASE WHEN status = 'Selesai' THEN 1 ELSE 0 END) AS completed,
      COALESCE(SUM(CASE WHEN status = 'Selesai' THEN s.price ELSE 0 END), 0) AS revenue
    FROM reservations r JOIN services s ON s.id = r.service_id WHERE booking_date = ?
  `).get(today)
  const activity = []
  for (let offset = -6; offset <= 0; offset++) {
    const date = localDate(offset)
    activity.push({ date, count: db.prepare('SELECT COUNT(*) AS count FROM reservations WHERE booking_date = ?').get(date).count })
  }
  res.json({ summary, activity, queue: getQueue(today).slice(0, 5) })
})

app.get('/api/admin/queue', auth, allow('admin'), (req, res) => {
  const date = isDate(req.query.date) ? req.query.date : localDate()
  res.json({ queue: getQueue(date), date })
})

app.get('/api/admin/waitlist', auth, allow('admin'), (req, res) => {
  expirePastWaitlists()
  const rows = db.prepare(waitlistSelect("WHERE w.status = 'Menunggu'", 'ORDER BY w.booking_date, w.booking_time, w.created_at')).all()
  res.json({ waitlist: rows.map((row) => mapWaitlist(row, { includeActivation: true })) })
})

app.post('/api/admin/waitlist/:id/activate', auth, allow('admin'), (req, res) => {
  try {
    const reservation = activateWaitlist(Number(req.params.id))
    res.json({ reservation })
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Waitlist gagal diaktifkan.' })
  }
})

function updateReservationStatus(req, res) {
  const id = Number(req.params.id)
  const status = cleanText(req.body.status, 30)
  const allowed = ['Menunggu', 'Giliran Anda', 'Proses', 'Selesai', 'No-show', 'Dibatalkan']
  if (!allowed.includes(status)) return res.status(400).json({ message: 'Status tidak valid.' })
  const current = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id)
  if (!current) return res.status(404).json({ message: 'Reservasi tidak ditemukan.' })
  if (req.user.role === 'barber' && current.barber_id !== req.user.id) return res.status(403).json({ message: 'Reservasi ini bukan antrian Anda.' })
  if (req.user.role === 'barber') {
    const transitions = { 'Menunggu': ['Proses', 'No-show'], 'Giliran Anda': ['Proses', 'No-show'], 'Proses': ['Selesai'] }
    if (!transitions[current.status]?.includes(status)) return res.status(409).json({ message: 'Urutan status pelayanan tidak valid.' })
  }
  if (status === 'Proses') {
    if (!current.checked_in_at) return res.status(409).json({ message: 'Pelanggan harus check-in sebelum pelayanan dimulai.' })
    const otherActive = db.prepare(`SELECT id FROM reservations WHERE barber_id = ? AND booking_date = ? AND status = 'Proses' AND id != ? LIMIT 1`).get(current.barber_id, current.booking_date, id)
    if (otherActive) return res.status(409).json({ message: 'Selesaikan pelanggan yang sedang diproses terlebih dahulu.' })
  }
  if (status === 'No-show' && current.checked_in_at) return res.status(409).json({ message: 'Pelanggan yang sudah check-in tidak dapat ditandai no-show.' })
  if (status === 'Giliran Anda') {
    const otherCalled = db.prepare(`SELECT id FROM reservations WHERE barber_id = ? AND booking_date = ? AND status = 'Giliran Anda' AND id != ? LIMIT 1`).get(current.barber_id, current.booking_date, id)
    if (otherCalled) return res.status(409).json({ message: 'Masih ada pelanggan lain yang sedang dipanggil.' })
  }
  db.exec('BEGIN IMMEDIATE')
  try {
    const started = status === 'Proses' ? ', started_at = CURRENT_TIMESTAMP' : ''
    const completed = status === 'Selesai' ? ', completed_at = CURRENT_TIMESTAMP' : ''
    db.prepare(`UPDATE reservations SET status = ?, updated_at = CURRENT_TIMESTAMP ${started} ${completed} WHERE id = ?`).run(status, id)
    if (['Selesai', 'No-show', 'Dibatalkan'].includes(status)) promoteNext(current.barber_id, current.booking_date)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  if (['No-show', 'Dibatalkan'].includes(status)) {
    const service = db.prepare('SELECT duration FROM services WHERE id = ?').get(current.service_id)
    promoteWaitlistForSlot(current.barber_id, current.booking_date, current.booking_time, service?.duration || 30)
  }
  broadcast('queue-updated', { reservationId: id, action: 'status', status })
  res.json({ reservation: getReservation(id), queue: getQueue(current.booking_date) })
}

app.patch('/api/admin/reservations/:id/status', auth, allow('admin'), updateReservationStatus)

app.get('/api/admin/master', auth, allow('admin'), (_req, res) => {
  const services = db.prepare('SELECT * FROM services ORDER BY active DESC, price').all()
  const barbers = barberRows(true)
  const members = db.prepare(`SELECT id, name, email, phone, membership, active FROM users WHERE role = 'customer' ORDER BY id DESC`).all()
  res.json({ services, barbers, members })
})

app.post('/api/admin/master', auth, allow('admin'), (req, res) => {
  const type = cleanText(req.body.type, 30)
  const name = cleanText(req.body.name, 100)
  if (name.length < 2) return res.status(400).json({ message: 'Nama data minimal 2 karakter.' })
  const slug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  try {
    if (type === 'Layanan') {
      db.prepare(`INSERT INTO services (id, name, description, duration, price, icon, priority_value, saw_value) VALUES (?, ?, ?, 30, 30000, '✂', .7, 2)`).run(slug, name, 'Layanan baru')
    } else if (type === 'Barber') {
      db.prepare(`INSERT INTO users (email, password_hash, role, name, membership, specialty, rating, shift_start, shift_end) VALUES (?, ?, 'barber', ?, 'Staff', 'Barber', 5, '09:00', '17:00')`).run(`${slug}@barbershop.local`, bcrypt.hashSync('barber123', 10), name)
    } else if (type === 'Member') {
      db.prepare(`INSERT INTO users (email, password_hash, role, name, membership) VALUES (?, ?, 'customer', ?, 'Regular')`).run(`${slug}@member.local`, bcrypt.hashSync('12345678', 10), name)
    } else {
      return res.status(400).json({ message: 'Jenis data belum didukung.' })
    }
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return res.status(409).json({ message: 'Data dengan nama tersebut sudah ada.' })
    throw error
  }
  broadcast('master-updated', { type })
  res.status(201).json({ message: 'Data berhasil ditambahkan.' })
})

app.patch('/api/admin/services/:id', auth, allow('admin'), (req, res) => {
  const current = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id)
  if (!current) return res.status(404).json({ message: 'Layanan tidak ditemukan.' })
  const name = cleanText(req.body.name, 100) || current.name
  const description = cleanText(req.body.description, 250) || current.description
  const duration = Number(req.body.duration)
  const price = Number(req.body.price)
  const sawValue = Number(req.body.sawValue)
  const active = req.body.active === false || req.body.active === 0 ? 0 : 1
  if (!Number.isInteger(duration) || duration < 10 || duration > 240 || !Number.isInteger(price) || price < 0 || ![1, 2, 3].includes(sawValue)) return res.status(400).json({ message: 'Durasi, harga, atau nilai SAW tidak valid.' })
  db.prepare('UPDATE services SET name = ?, description = ?, duration = ?, price = ?, saw_value = ?, active = ? WHERE id = ?').run(name, description, duration, price, sawValue, active, current.id)
  for (const row of db.prepare(`SELECT DISTINCT booking_date FROM reservations WHERE service_id = ? AND status NOT IN ('Selesai', 'No-show', 'Dibatalkan')`).all(current.id)) recalculateSaw(row.booking_date)
  broadcast('master-updated', { type: 'Layanan', id: current.id })
  res.json({ service: db.prepare('SELECT * FROM services WHERE id = ?').get(current.id) })
})

app.patch('/api/admin/users/:id', auth, allow('admin'), (req, res) => {
  const current = db.prepare(`SELECT * FROM users WHERE id = ? AND role IN ('barber', 'customer')`).get(Number(req.params.id))
  if (!current) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' })
  const name = cleanText(req.body.name, 100) || current.name
  const phone = cleanText(req.body.phone, 30)
  const membership = current.role === 'customer' && ['Regular', 'Silver', 'Gold'].includes(req.body.membership) ? req.body.membership : current.membership
  const specialty = current.role === 'barber' ? cleanText(req.body.specialty, 100) || current.specialty : current.specialty
  const shiftStart = current.role === 'barber' && isTime(req.body.shiftStart) ? req.body.shiftStart : current.shift_start
  const shiftEnd = current.role === 'barber' && isTime(req.body.shiftEnd) ? req.body.shiftEnd : current.shift_end
  const active = req.body.active === false || req.body.active === 0 ? 0 : 1
  if (current.role === 'barber' && shiftStart >= shiftEnd) return res.status(400).json({ message: 'Jam selesai harus lebih besar dari jam mulai.' })
  db.prepare(`UPDATE users SET name = ?, phone = ?, membership = ?, specialty = ?, shift_start = ?, shift_end = ?, active = ? WHERE id = ?`).run(name, phone, membership, specialty, shiftStart, shiftEnd, active, current.id)
  if (current.role === 'customer') {
    for (const row of db.prepare(`SELECT DISTINCT booking_date FROM reservations WHERE customer_id = ? AND status NOT IN ('Selesai', 'No-show', 'Dibatalkan')`).all(current.id)) recalculateSaw(row.booking_date)
  }
  broadcast('master-updated', { type: current.role, id: current.id })
  res.json({ user: mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(current.id)) })
})

app.get('/api/admin/reports', auth, allow('admin'), (req, res) => {
  const period = ['daily', 'weekly', 'monthly'].includes(req.query.period) ? req.query.period : 'daily'
  const days = period === 'monthly' ? 30 : period === 'weekly' ? 7 : 1
  const start = localDate(-(days - 1))
  const end = localDate()
  const summary = db.prepare(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN r.status = 'Selesai' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN r.status = 'No-show' THEN 1 ELSE 0 END) AS noShow,
      COALESCE(SUM(CASE WHEN r.status = 'Selesai' THEN s.price ELSE 0 END), 0) AS revenue
    FROM reservations r JOIN services s ON s.id = r.service_id
    WHERE r.booking_date BETWEEN ? AND ?
  `).get(start, end)
  const performance = db.prepare(`
    SELECT s.id, s.name, COUNT(r.id) AS count,
      COALESCE(SUM(CASE WHEN r.status = 'Selesai' THEN s.price ELSE 0 END), 0) AS revenue
    FROM services s LEFT JOIN reservations r ON r.service_id = s.id AND r.booking_date BETWEEN ? AND ?
    GROUP BY s.id ORDER BY count DESC
  `).all(start, end)
  const activity = db.prepare(`SELECT booking_date AS date, COUNT(*) AS count FROM reservations WHERE booking_date BETWEEN ? AND ? GROUP BY booking_date ORDER BY booking_date`).all(start, end)
  res.json({ period, range: { start, end }, summary, performance, activity })
})

app.get('/api/barber/dashboard', auth, allow('barber'), (req, res) => {
  const date = localDate()
  const rows = db.prepare(reservationSelect('WHERE r.barber_id = ? AND r.booking_date = ? AND r.status != \'Dibatalkan\'', `ORDER BY CASE r.status WHEN 'Proses' THEN 1 WHEN 'Giliran Anda' THEN 2 WHEN 'Menunggu' THEN 3 ELSE 4 END, r.booking_time`)).all(req.user.id, date).map(mapReservation)
  const completed = rows.filter((item) => item.status === 'Selesai').length
  const remaining = rows.filter((item) => !['Selesai', 'No-show'].includes(item.status)).length
  const avgRow = db.prepare(`SELECT AVG(s.duration) AS average FROM reservations r JOIN services s ON s.id = r.service_id WHERE r.barber_id = ? AND r.status = 'Selesai'`).get(req.user.id)
  res.json({ queue: rows, summary: { completed, remaining, averageDuration: Math.round(avgRow.average || 0) } })
})

app.patch('/api/barber/reservations/:id/status', auth, allow('barber'), updateReservationStatus)

app.get('/api', (_req, res) => res.json({
  name: 'Pangkas Rambut Anda API',
  status: 'online',
  health: '/api/health',
  web: process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:5173',
}))

if (process.env.NODE_ENV !== 'production') {
  app.get('/', (_req, res) => res.type('html').send(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Barbershop API</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f0e8;color:#173137;font:16px system-ui}.card{max-width:520px;padding:36px;border-radius:20px;background:#fffefa;box-shadow:0 18px 50px #17313718}a{display:inline-block;margin-top:14px;padding:11px 16px;border-radius:10px;background:#c98f3b;color:white;text-decoration:none;font-weight:700}code{color:#a96f22}</style></head><body><main class="card"><h1>API aktif ✓</h1><p>Backend Pangkas Rambut Anda berjalan di <code>127.0.0.1:${port}</code>.</p><p>Website development tersedia melalui Vite.</p><a href="http://localhost:5173">Buka website</a></main></body></html>`))
}

app.use('/api', (_req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan.' }))

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(rootDir, 'dist')))
  app.use((_req, res) => res.sendFile(path.join(rootDir, 'dist', 'index.html')))
}

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ message: 'Terjadi kesalahan pada server.' })
})

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`API barbershop berjalan di http://127.0.0.1:${port}`)
})

server.on('error', (error) => {
  console.error('API gagal berjalan:', error.message)
  process.exitCode = 1
})

function shutdown() {
  for (const client of eventClients) client.end()
  eventClients.clear()
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 3000).unref()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
