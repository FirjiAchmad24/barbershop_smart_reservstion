import React, { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileDown,
  ListChecks,
  ListOrdered,
  LockKeyhole,
  Mail,
  Medal,
  MessageSquareText,
  Phone,
  Plus,
  Scissors,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  TimerReset,
  TrendingUp,
  UserRound,
  UsersRound,
  WandSparkles,
} from 'lucide-react'
import {
  AppShell,
  Brand,
  Modal,
  PageIntro,
  Stars,
  StatCard,
  StatusBadge,
} from './components'
import { api, subscribeToEvents } from './api'
import { formatCurrency } from './data'

const pageMeta = {
  customer: {
    home: ['Selamat datang, Andry', 'Atur reservasi tanpa antre lama.'],
    queue: ['Status antrian', 'Pantau progres pelayanan secara real-time.'],
    history: ['Riwayat reservasi', 'Semua reservasi dan transaksi Anda.'],
    profile: ['Profil saya', 'Kelola informasi member dan preferensi akun.'],
  },
  admin: {
    dashboard: ['Dashboard admin', 'Ringkasan operasional barbershop hari ini.'],
    queues: ['Kelola antrian', 'Urutan prioritas pelanggan hari ini.'],
    saw: ['Detail perhitungan SAW', 'Transparansi pembentukan skor prioritas.'],
    master: ['Data master', 'Kelola data utama sistem reservasi.'],
    reports: ['Laporan', 'Rekap transaksi dan performa layanan.'],
  },
  barber: {
    dashboard: ['Dashboard barber', 'Antrian pelayanan Anda hari ini.'],
    customers: ['Detail pelanggan', 'Informasi reservasi dan status pelayanan.'],
    schedule: ['Jadwal saya', 'Jadwal kerja dan reservasi mendatang.'],
  },
}

function App() {
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    api('/auth/me').then(({ user: sessionUser }) => setUser(sessionUser)).catch(() => setUser(null))
  }, [])
  useEffect(() => {
    const expire = () => setUser(null)
    window.addEventListener('auth-expired', expire)
    return () => window.removeEventListener('auth-expired', expire)
  }, [])

  const login = async (credentials) => {
    const result = await api('/auth/login', { method: 'POST', body: credentials })
    setUser(result.user)
  }

  const logout = async () => {
    try { await api('/auth/logout', { method: 'POST' }) } finally { setUser(null) }
  }

  if (user === undefined) return <LoadingScreen />
  if (!user) return <LoginScreen onLogin={login} onSession={setUser} />
  if (user.role === 'customer') return <CustomerApp user={user} onUserChange={setUser} onLogout={logout} />
  if (user.role === 'admin') return <AdminApp user={user} onLogout={logout} />
  return <BarberApp user={user} onLogout={logout} />
}

function LoadingScreen() {
  return <main className="loading-screen"><Brand /><span className="loading-spinner" /><p>Menyiapkan workspace…</p></main>
}

function LoginScreen({ onLogin, onSession }) {
  const [email, setEmail] = useState('pelanggan@email.com')
  const [password, setPassword] = useState('12345678')
  const [showIntro, setShowIntro] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [registerOpen, setRegisterOpen] = useState(false)

  if (showIntro) {
    return (
      <main className="welcome-screen">
        <section className="welcome-copy">
          <Brand />
          <div className="welcome-copy__body">
            <span className="welcome-kicker"><Sparkles size={16} /> Reservasi • Antrian • SAW</span>
            <h1>Pangkas rambut tanpa menunggu <em>terlalu lama.</em></h1>
            <p>Pilih layanan, tentukan barber, lalu sistem mengatur prioritas antrian secara otomatis dan transparan.</p>
            <button className="button button--gold button--large" onClick={() => setShowIntro(false)}>
              Mulai reservasi <ArrowRight size={19} />
            </button>
            <div className="welcome-points">
              <div><span><Clock3 size={18} /></span><strong>Real-time</strong><small>Estimasi waktu tunggu</small></div>
              <div><span><ShieldCheck size={18} /></span><strong>Transparan</strong><small>Prioritas metode SAW</small></div>
              <div><span><Medal size={18} /></span><strong>Profesional</strong><small>Barber berpengalaman</small></div>
            </div>
          </div>
        </section>
        <section className="welcome-visual" aria-hidden="true">
          <div className="welcome-visual__orb welcome-visual__orb--one" />
          <div className="welcome-visual__orb welcome-visual__orb--two" />
          <div className="barber-illustration">
            <span className="barber-illustration__head" />
            <span className="barber-illustration__body"><Scissors size={58} /></span>
            <i className="barber-illustration__line" />
          </div>
          <div className="floating-card floating-card--top"><CheckCircle2 size={22} /><div><strong>Reservasi terkonfirmasi</strong><small>25 Juni • 10:00 WITA</small></div></div>
          <div className="floating-card floating-card--bottom"><TimerReset size={22} /><div><strong>Estimasi 18 menit</strong><small>Antrian Anda A-07</small></div></div>
        </section>
      </main>
    )
  }

  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try { await onLogin({ email, password }) }
    catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }

  const demoLogin = async (role) => {
    const credentials = role === 'admin'
      ? { email: 'admin@barbershop.com', password: 'admin123' }
      : { email: 'budi@barbershop.com', password: 'barber123' }
    setLoading(true)
    setError('')
    try { await onLogin(credentials) }
    catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }

  return (
    <main className="login-screen">
      <section className="login-promo">
        <Brand />
        <div>
          <p className="eyebrow eyebrow--light">Smart reservation system</p>
          <h1>Waktu Anda terlalu berharga untuk dihabiskan menunggu.</h1>
          <p>Kelola jadwal potong rambut dengan pengalaman reservasi yang rapi, cepat, dan nyaman.</p>
        </div>
        <div className="login-quote"><Scissors size={22} /><p>Gaya terbaik dimulai dari jadwal yang tepat.</p></div>
      </section>
      <section className="login-panel">
        <button className="back-link" onClick={() => setShowIntro(true)}><ArrowLeft size={17} /> Kembali</button>
        <div className="login-card">
          <div className="login-card__heading">
            <span className="login-card__icon"><UserRound size={24} /></span>
            <h2>Selamat datang</h2>
            <p>Masuk untuk mengelola reservasi dan antrian.</p>
          </div>
          <form onSubmit={submit}>
            <label>Email<div className="input-wrap"><Mail size={18} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div></label>
            <label>Password<div className="input-wrap"><LockKeyhole size={18} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div></label>
            {error && <div className="form-error">{error}</div>}
            <button className="button button--gold button--full" type="submit" disabled={loading}>{loading ? 'Memproses…' : 'Masuk sebagai pelanggan'} {!loading && <ArrowRight size={18} />}</button>
          </form>
          <div className="divider"><span>atau masuk sebagai</span></div>
          <div className="role-buttons">
            <button className="button button--outline" disabled={loading} onClick={() => demoLogin('admin')}>Admin / Pemilik</button>
            <button className="button button--outline" disabled={loading} onClick={() => demoLogin('barber')}>Barber / Capster</button>
          </div>
          <p className="register-copy">Belum punya akun? <button onClick={() => setRegisterOpen(true)}>Daftar member</button></p>
        </div>
      </section>
      {registerOpen && <RegisterModal onClose={() => setRegisterOpen(false)} onRegistered={onSession} />}
    </main>
  )
}

function RegisterModal({ onClose, onRegistered }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const submit = async (event) => {
    event.preventDefault(); setLoading(true); setError('')
    try { const result = await api('/auth/register', { method: 'POST', body: form }); onRegistered(result.user) }
    catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }
  return (
    <Modal onClose={onClose}>
      <div className="modal-heading"><span className="modal-heading__icon"><UserRound size={25} /></span><p className="eyebrow">Member baru</p><h2>Buat akun pelanggan</h2><p>Data akun disimpan aman di database.</p></div>
      <form className="modal-form" onSubmit={submit}>
        <label>Nama lengkap<input value={form.name} onChange={update('name')} required /></label>
        <label>Email<input type="email" value={form.email} onChange={update('email')} required /></label>
        <label>Nomor telepon<input value={form.phone} onChange={update('phone')} /></label>
        <label>Password<input type="password" minLength="8" value={form.password} onChange={update('password')} required /></label>
        {error && <div className="form-error">{error}</div>}
        <button className="button button--gold button--full" disabled={loading}>{loading ? 'Mendaftarkan…' : 'Daftar dan masuk'}</button>
      </form>
    </Modal>
  )
}

function CustomerApp({ user, onUserChange, onLogout }) {
  const [active, setActive] = useState('home')
  const [booking, setBooking] = useState(null)
  const [ratingTarget, setRatingTarget] = useState(null)
  const [bootstrap, setBootstrap] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [reservations, setReservations] = useState([])
  const [queue, setQueue] = useState([])
  const [waitlist, setWaitlist] = useState([])
  const [error, setError] = useState('')
  const meta = pageMeta.customer[active] || pageMeta.customer.home

  const loadData = useCallback(async () => {
    try {
      const [bootstrapData, dashboardData, reservationData, queueData, waitlistData] = await Promise.all([
        api('/bootstrap'), api('/customer/dashboard'), api('/customer/reservations'), api('/queue'), api('/customer/waitlist'),
      ])
      setBootstrap(bootstrapData)
      setDashboard(dashboardData)
      setReservations(reservationData.reservations)
      setQueue(queueData.queue)
      setWaitlist(waitlistData.waitlist)
      setError('')
    } catch (requestError) { setError(requestError.message) }
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => subscribeToEvents((type) => { if (['queue-updated', 'rating-created', 'waitlist-updated'].includes(type)) loadData() }), [loadData])

  const navigate = (page) => {
    setActive(page)
    setBooking(null)
  }

  return (
    <AppShell
      role="customer"
      user={user}
      active={active}
      onNavigate={navigate}
      onLogout={onLogout}
      title={meta[0]}
      subtitle={meta[1]}
      action={<button className="button button--gold" onClick={() => setBooking({ serviceId: 'basic' })}><Plus size={17} /> Reservasi baru</button>}
    >
      {error && <div className="page-error">{error}<button onClick={loadData}>Coba lagi</button></div>}
      {!bootstrap || !dashboard ? <ContentLoader /> : booking ? (
        <BookingFlow
          initialService={booking.serviceId}
          services={bootstrap.services}
          barbers={bootstrap.barbers}
          dates={bootstrap.bookingDates}
          user={user}
          onCancel={() => setBooking(null)}
          onCreated={loadData}
          onDone={() => { setBooking(null); setActive('queue'); loadData() }}
        />
      ) : (
        <>
          {active === 'home' && <CustomerHome services={bootstrap.services} dashboard={dashboard} queue={queue} onBook={(serviceId = bootstrap.services[0]?.id) => setBooking({ serviceId })} onQueue={() => setActive('queue')} />}
          {active === 'queue' && <CustomerQueue user={user} queue={queue} waitlist={waitlist} activeReservation={dashboard.activeReservation} reservations={reservations} onRating={setRatingTarget} onRefresh={loadData} />}
          {active === 'history' && <CustomerHistory reservations={reservations} onRating={setRatingTarget} />}
          {active === 'profile' && <CustomerProfile user={user} barbers={bootstrap.barbers} reservationCount={dashboard.totalReservations} onUserChange={onUserChange} />}
        </>
      )}
      {ratingTarget && <RatingModal reservation={ratingTarget} onClose={() => setRatingTarget(null)} onSubmitted={loadData} />}
    </AppShell>
  )
}

function ContentLoader() {
  return <div className="content-loader"><span className="loading-spinner" /><p>Memuat data terbaru…</p></div>
}

function CustomerHome({ services, dashboard, queue, onBook, onQueue }) {
  const current = dashboard.activeReservation
  const queuePosition = current ? Math.max(0, queue.findIndex((item) => item.id === current.id)) : 0
  const estimate = current?.status === 'Giliran Anda' ? 0 : queuePosition * 18
  return (
    <div className="stack-xl">
      <section className="hero-card">
        <div className="hero-card__content">
          <span className="hero-card__tag"><WandSparkles size={15} /> Reservasi pintar</span>
          <h2>Antrian lebih teratur dengan prioritas SAW.</h2>
          <p>Status member, jenis layanan, dan ketepatan waktu dihitung otomatis untuk pengalaman yang lebih adil.</p>
          <div className="button-row">
            <button className="button button--gold" onClick={() => onBook('basic')}>Reservasi sekarang <ArrowRight size={17} /></button>
            <button className="button button--ghost-light" onClick={onQueue}>Pantau antrian</button>
          </div>
        </div>
        <div className="hero-card__art"><span><Scissors size={74} /></span><i /><b /></div>
      </section>

      <section className="stats-grid stats-grid--three">
        <StatCard icon={ListOrdered} label="Nomor antrian" value={current?.number || '—'} tone="gold" trend={current?.status || 'Belum ada reservasi'} />
        <StatCard icon={Clock3} label="Estimasi tunggu" value={estimate} suffix=" menit" tone="green" trend={current ? 'Diperbarui otomatis' : 'Buat reservasi dahulu'} />
        <StatCard icon={UsersRound} label="Barber tersedia" value={dashboard.availableBarbers} tone="blue" trend="Sesuai jadwal aktif" />
      </section>

      <section>
        <PageIntro eyebrow="Layanan populer" title="Pilih gaya, kami atur waktunya" description="Harga transparan dan durasi yang bisa Anda andalkan." />
        <div className="service-grid">
          {services.map((service, index) => (
            <article className="service-card" key={service.id}>
              <span className="service-card__number">0{index + 1}</span>
              <span className="service-card__icon">{service.icon}</span>
              <div><h3>{service.name}</h3><p>{service.description}</p></div>
              <div className="service-card__meta"><span><Clock3 size={15} /> {service.duration} menit</span><strong>{formatCurrency(service.price)}</strong></div>
              <button onClick={() => onBook(service.id)}>Pilih layanan <ChevronRight size={17} /></button>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function BookingFlow({ initialService, services, barbers, dates, user, onCancel, onCreated, onDone }) {
  const [step, setStep] = useState(0)
  const [serviceId, setServiceId] = useState(initialService || services[0].id)
  const [barberId, setBarberId] = useState(barbers[0].id)
  const [dateId, setDateId] = useState(dates[0].id)
  const [time, setTime] = useState('')
  const [slots, setSlots] = useState([])
  const [createdReservation, setCreatedReservation] = useState(null)
  const [waitlistEntry, setWaitlistEntry] = useState(null)
  const [waitlistTime, setWaitlistTime] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const selectedService = services.find((item) => item.id === serviceId)
  const selectedBarber = barbers.find((item) => item.id === Number(barberId))
  const selectedDate = dates.find((item) => item.id === dateId)
  const steps = ['Layanan', 'Barber', 'Jadwal', 'Konfirmasi']

  useEffect(() => {
    let active = true
    setTime('')
    api(`/availability?barberId=${barberId}&date=${dateId}&serviceId=${serviceId}`).then(({ slots: availableSlots }) => {
      if (!active) return
      setSlots(availableSlots)
      setTime(availableSlots.find((slot) => slot.available)?.time || '')
      setWaitlistTime(availableSlots.find((slot) => !slot.available)?.time || '')
    }).catch((requestError) => setError(requestError.message))
    return () => { active = false }
  }, [barberId, dateId, serviceId])

  const memberRaw = ['Gold', 'Silver', 'Member'].includes(user.membership) ? 3 : 1
  const serviceRaw = selectedService.sawValue ?? (selectedService.price >= 60000 ? 3 : selectedService.price >= 40000 ? 2 : 1)
  const punctualityRaw = 3
  const memberValue = memberRaw / 3
  const serviceValue = serviceRaw / 3
  const punctualityValue = punctualityRaw / 3
  const simulatedScore = (memberValue * .40 + serviceValue * .35 + punctualityValue * .25).toFixed(2)

  const createReservation = async () => {
    setSubmitting(true)
    setError('')
    try {
      const { reservation } = await api('/customer/reservations', { method: 'POST', body: { serviceId, barberId: Number(barberId), date: dateId, time } })
      setCreatedReservation(reservation)
      await onCreated()
    } catch (requestError) { setError(requestError.message); setStep(2) }
    finally { setSubmitting(false) }
  }

  const joinWaitlist = async () => {
    setSubmitting(true); setError('')
    try {
      const { entry } = await api('/customer/waitlist', { method: 'POST', body: { serviceId, barberId: Number(barberId), date: dateId, time: waitlistTime } })
      setWaitlistEntry(entry); await onCreated()
    } catch (requestError) { setError(requestError.message) }
    finally { setSubmitting(false) }
  }

  if (waitlistEntry) {
    return <section className="booking-success"><div className="booking-success__check"><TimerReset size={38} /></div><p className="eyebrow">Waitlist digital aktif</p><h2>Anda masuk daftar tunggu</h2><p>Sistem akan mengubah waitlist menjadi reservasi secara otomatis jika slot tersedia karena pembatalan atau no-show.</p><div className="success-ticket"><div><small>Jadwal</small><strong>{selectedDate.full}</strong><span>{waitlistEntry.time} WITA</span></div><div><small>Barber</small><strong>{selectedBarber.name}</strong><span>{selectedService.name}</span></div><div><small>Status</small><strong>{waitlistEntry.status}</strong><span>Notifikasi otomatis aktif</span></div></div><button className="button button--gold" onClick={onDone}>Pantau status <ArrowRight size={17} /></button></section>
  }

  if (createdReservation) {
    return (
      <section className="booking-success">
        <div className="booking-success__check"><Check size={38} /></div>
        <p className="eyebrow">Reservasi berhasil</p>
        <h2>Anda masuk antrian <strong>{createdReservation.number}</strong></h2>
        <p>Datang 10 menit sebelum jadwal agar skor ketepatan waktu Anda tetap tinggi.</p>
        <div className="success-ticket">
          <div><small>Jadwal</small><strong>{selectedDate.full}</strong><span>{time} WITA</span></div>
          <div><small>Barber</small><strong>{selectedBarber.name}</strong><span>{selectedService.name}</span></div>
          <div><small>Status</small><strong>{createdReservation.status}</strong><span>Skor SAW: {createdReservation.score.toFixed(2)}</span></div>
        </div>
        <div className="button-row button-row--center">
          <button className="button button--outline" onClick={onCancel}>Kembali ke beranda</button>
          <button className="button button--gold" onClick={onDone}>Pantau antrian <ArrowRight size={17} /></button>
        </div>
      </section>
    )
  }

  return (
    <section className="booking-layout">
      <div className="booking-main">
        <button className="back-link" onClick={step === 0 ? onCancel : () => setStep(step - 1)}><ArrowLeft size={17} /> {step === 0 ? 'Batal reservasi' : 'Kembali'}</button>
        <div className="booking-heading">
          <p className="eyebrow">Langkah {step + 1} dari 4</p>
          <h2>{step === 0 ? 'Pilih layanan' : step === 1 ? 'Siapa barber pilihan Anda?' : step === 2 ? 'Tentukan jadwal kunjungan' : 'Periksa kembali reservasi'}</h2>
          <p>{step === 0 ? 'Jenis layanan memengaruhi skor prioritas SAW.' : step === 1 ? 'Pilih capster yang tersedia hari ini.' : step === 2 ? 'Slot kosong tersedia secara real-time.' : 'Pastikan semua detail sudah sesuai.'}</p>
        </div>

        <div className="booking-stepper">
          {steps.map((label, index) => <div key={label} className={`${index <= step ? 'is-active' : ''} ${index < step ? 'is-done' : ''}`}><span>{index < step ? <Check size={15} /> : index + 1}</span><small>{label}</small></div>)}
        </div>

        {step === 0 && (
          <div className="choice-list">
            {services.map((service) => (
              <button className={`choice-card ${serviceId === service.id ? 'is-selected' : ''}`} key={service.id} onClick={() => setServiceId(service.id)}>
                <span className="choice-card__icon">{service.icon}</span>
                <div><h3>{service.name}</h3><p>{service.description}</p><small>{service.duration} menit • {formatCurrency(service.price)}</small></div>
                <i>{serviceId === service.id && <Check size={15} />}</i>
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="choice-list">
            {barbers.map((barber) => (
              <button className={`choice-card choice-card--barber ${barberId === barber.id ? 'is-selected' : ''}`} key={barber.id} onClick={() => setBarberId(barber.id)}>
                <span className="barber-avatar">{barber.initial}</span>
                <div><h3>{barber.name}</h3><p>{barber.specialty}</p><small><Star size={13} fill="currentColor" /> {barber.rating} <b>•</b> {barber.shift}</small></div>
                <i>{barberId === barber.id && <Check size={15} />}</i>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="schedule-picker">
            <h3>Tanggal</h3>
            <div className="date-grid">{dates.map((date) => <button className={dateId === date.id ? 'is-selected' : ''} key={date.id} onClick={() => setDateId(date.id)}><small>{date.day}</small><strong>{date.date}</strong></button>)}</div>
            <h3>Jam tersedia</h3>
            <div className="time-grid">{slots.map((slot) => <button disabled={!slot.available} className={time === slot.time ? 'is-selected' : ''} key={slot.time} onClick={() => setTime(slot.time)}><strong>{slot.time}</strong><small>{!slot.available ? 'Penuh' : time === slot.time ? 'Dipilih' : 'Tersedia'}</small></button>)}</div>
            {!slots.some((slot) => slot.available) && <div className="form-error">Semua slot barber ini sudah penuh. Pilih barber atau tanggal lain.</div>}
            {slots.some((slot) => !slot.available) && <div className="waitlist-box"><div><strong>Slot penuh yang Anda inginkan?</strong><p>Masuk waitlist dan dapatkan slot otomatis saat ada pembatalan atau no-show.</p></div><select value={waitlistTime} onChange={(event) => setWaitlistTime(event.target.value)}>{slots.filter((slot) => !slot.available).map((slot) => <option key={slot.time} value={slot.time}>{slot.time} WITA</option>)}</select><button className="button button--outline" disabled={!waitlistTime || submitting} onClick={joinWaitlist}>Gabung waitlist</button></div>}
            <div className="info-note"><TimerReset size={20} /><div><strong>Waitlist digital aktif</strong><p>Jika pelanggan no-show, sistem otomatis menawarkan slot ke pelanggan di daftar tunggu.</p></div></div>
          </div>
        )}

        {step === 3 && (
          <div className="confirmation-grid">
            <div className="detail-card"><h3>Detail reservasi</h3><dl><div><dt>Layanan</dt><dd>{selectedService.name}</dd></div><div><dt>Barber</dt><dd>{selectedBarber.name}</dd></div><div><dt>Tanggal</dt><dd>{selectedDate.full}</dd></div><div><dt>Jam</dt><dd>{time} WITA</dd></div><div><dt>Harga</dt><dd>{formatCurrency(selectedService.price)}</dd></div></dl></div>
            <div className="saw-card"><div><p className="eyebrow">Simulasi prioritas SAW</p><h3>Skor preferensi awal</h3></div><strong className="saw-score">{simulatedScore}</strong><div className="score-bars"><span><small>Status member ({memberRaw})</small><i><b style={{ width: `${memberValue * 100}%` }} /></i><em>0.40</em></span><span><small>Jenis layanan ({serviceRaw})</small><i><b style={{ width: `${serviceValue * 100}%` }} /></i><em>0.35</em></span><span><small>Ketepatan waktu ({punctualityRaw})</small><i><b style={{ width: `${punctualityValue * 100}%` }} /></i><em>0.25</em></span></div><p>Nilai C3 masih provisional dan dihitung ulang saat pelanggan check-in.</p></div>
          </div>
        )}

        <div className="booking-actions">
          <span>{error || (step === 3 ? `Total ${formatCurrency(selectedService.price)}` : 'Pilihan dapat diubah sebelum konfirmasi.')}</span>
          <button className="button button--gold" disabled={(step >= 2 && !time) || submitting} onClick={() => step < 3 ? setStep(step + 1) : createReservation()}>{submitting ? 'Menyimpan…' : step < 3 ? 'Lanjutkan' : 'Buat reservasi'} {!submitting && <ArrowRight size={17} />}</button>
        </div>
      </div>

      <aside className="booking-summary">
        <p className="eyebrow">Ringkasan pilihan</p>
        <div className="booking-summary__service"><span>{selectedService.icon}</span><div><small>Layanan</small><strong>{selectedService.name}</strong><p>{selectedService.duration} menit</p></div></div>
        <dl><div><dt>Barber</dt><dd>{selectedBarber.name}</dd></div><div><dt>Jadwal</dt><dd>{selectedDate.date}, {time}</dd></div><div><dt>Harga</dt><dd>{formatCurrency(selectedService.price)}</dd></div></dl>
        <div className="booking-summary__tip"><ShieldCheck size={19} /><p>Pembayaran dilakukan langsung di barbershop setelah layanan selesai.</p></div>
      </aside>
    </section>
  )
}

function CustomerQueue({ user, queue, waitlist, activeReservation, reservations, onRating, onRefresh }) {
  const mine = queue.find((item) => item.id === activeReservation?.id) || activeReservation
  const completedWithoutRating = reservations.find((item) => item.status === 'Selesai' && !item.rating)
  const position = mine ? queue.findIndex((item) => item.id === mine.id) : -1
  const estimate = Math.max(0, position) * 18
  const cancel = async () => {
    if (!mine || !window.confirm(`Batalkan reservasi ${mine.number}?`)) return
    try { await api(`/customer/reservations/${mine.id}/cancel`, { method: 'PATCH' }); onRefresh() }
    catch (requestError) { window.alert(requestError.message) }
  }
  if (!mine) return <div className="stack-xl"><section className="panel"><PageIntro eyebrow="Antrian saya" title="Belum ada antrian aktif" description="Buat reservasi baru untuk mendapatkan nomor antrian." /></section>{waitlist.filter((item) => item.status === 'Menunggu').map((item) => <article className="waitlist-customer-card" key={item.id}><TimerReset size={22} /><div><p className="eyebrow">Waitlist aktif</p><h3>{item.service}</h3><span>{formatBookingDate(item.date)} • {item.time} WITA • {item.barber}</span></div><StatusBadge status={item.status} /></article>)}</div>
  return (
    <div className="queue-page">
      <section className="live-queue-card">
        <div className="live-queue-card__top"><span className="live-dot" /> {mine.status}</div>
        <div className="live-queue-card__number"><div><small>Nomor Anda</small><strong>{mine.number}</strong></div><span><b>{estimate}</b> menit<small>estimasi tunggu</small></span></div>
        <div className="queue-progress"><i /><i /><i className="is-active" /><i /></div>
        <div className="queue-labels"><span>Terdaftar</span><span>Menunggu</span><span>Giliran Anda</span><span>Selesai</span></div>
        <div className="live-queue-card__footer"><span>Barber <strong>{mine.barber}</strong></span><span>Jadwal <strong>{mine.time} WITA</strong></span></div>
        {['Menunggu', 'Giliran Anda'].includes(mine.status) && <button className="queue-cancel" onClick={cancel}>Batalkan reservasi</button>}
      </section>
      <section className="panel">
        <div className="panel__header"><div><p className="eyebrow">Daftar antrian</p><h2>Urutan pelayanan hari ini</h2></div><span className="auto-refresh"><TimerReset size={15} /> diperbarui otomatis</span></div>
        <div className="queue-table queue-table--customer">
          <div className="queue-table__head"><span>Nomor</span><span>Pelanggan</span><span>Barber</span><span>Status</span></div>
          {queue.map((item) => <div className={item.customerId === user.id ? 'is-mine' : ''} key={item.id}><strong>{item.number}</strong><span>{item.name}</span><span>{item.barber}</span><StatusBadge status={item.status} /></div>)}
        </div>
      </section>
      <section className="queue-help"><div><CheckCircle2 size={23} /><span><strong>{completedWithoutRating ? 'Layanan sudah selesai?' : 'Status diperbarui real-time'}</strong><small>{completedWithoutRating ? 'Bantu kami meningkatkan kualitas pelayanan.' : 'Halaman akan mengikuti perubahan dari barber dan admin.'}</small></span></div>{completedWithoutRating && <button className="button button--outline" onClick={() => onRating(completedWithoutRating)}>Beri rating</button>}</section>
    </div>
  )
}

function formatBookingDate(value) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' }).format(new Date(`${value}T00:00:00+08:00`))
}

function CustomerHistory({ reservations, onRating }) {
  const download = () => {
    const rows = [['Tanggal', 'Layanan', 'Barber', 'Status', 'Harga'], ...reservations.map((item) => [item.date, item.service, item.barber, item.status, item.price])]
    const blob = new Blob([rows.map((row) => row.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'riwayat-reservasi.csv'; link.click(); URL.revokeObjectURL(link.href)
  }
  return (
    <section className="panel">
      <div className="panel__header"><div><p className="eyebrow">Aktivitas Anda</p><h2>Riwayat reservasi</h2></div><button className="button button--outline" onClick={download}><FileDown size={17} /> Unduh riwayat</button></div>
      <div className="history-list">
        {reservations.map((item) => (
          <article key={item.id}>
            <span className="history-list__date"><CalendarDays size={18} /><strong>{formatBookingDate(item.date)}</strong></span>
            <div><h3>{item.service}</h3><p>Ditangani oleh {item.barber}</p></div>
            <strong>{formatCurrency(item.price)}</strong>
            <StatusBadge status={item.status} />
            {item.status === 'Selesai' && !item.rating ? <button onClick={() => onRating(item)}>Beri rating</button> : <span className="history-state">{item.rating ? `${item.rating.stars} ★` : '—'}</span>}
          </article>
        ))}
      </div>
    </section>
  )
}

function CustomerProfile({ user, barbers, reservationCount, onUserChange }) {
  const [saved, setSaved] = useState(false)
  const [name, setName] = useState(user.name)
  const [phone, setPhone] = useState(user.phone)
  const [favoriteBarberId, setFavoriteBarberId] = useState(user.favoriteBarberId || barbers[0]?.id || '')
  const [error, setError] = useState('')
  const save = async () => {
    setError('')
    try {
      const { user: updated } = await api('/customer/profile', { method: 'PUT', body: { name, phone, favoriteBarberId: Number(favoriteBarberId) } })
      onUserChange(updated); setSaved(true); setTimeout(() => setSaved(false), 1800)
    } catch (requestError) { setError(requestError.message) }
  }
  return (
    <div className="profile-layout">
      <section className="profile-card">
        <div className="profile-card__cover" />
        <span className="profile-card__avatar">{user.name.charAt(0)}</span>
        <h2>{user.name}</h2><p>{user.email}</p>
        <span className="member-badge"><Medal size={15} /> {user.membership} Member</span>
        <div className="profile-card__stats"><div><strong>{reservationCount}</strong><small>Reservasi</small></div><div><strong>{barbers.find((item) => item.id === user.favoriteBarberId)?.rating || '—'}</strong><small>Barber favorit</small></div><div><strong>{Math.round(user.attendanceRate * 100)}%</strong><small>Kehadiran</small></div></div>
      </section>
      <section className="panel profile-form">
        <div className="panel__header"><div><p className="eyebrow">Informasi member</p><h2>Data pribadi</h2></div></div>
        <div className="form-grid">
          <label>Nama lengkap<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Nomor telepon<div className="input-wrap"><Phone size={17} /><input value={phone} onChange={(event) => setPhone(event.target.value)} /></div></label>
          <label>Email<div className="input-wrap"><Mail size={17} /><input value={user.email} disabled /></div></label>
          <label>Barber favorit<select value={favoriteBarberId} onChange={(event) => setFavoriteBarberId(event.target.value)}>{barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.name}</option>)}</select></label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <button className="button button--gold" onClick={save}>{saved ? <><Check size={17} /> Tersimpan</> : 'Simpan perubahan'}</button>
      </section>
    </div>
  )
}

function RatingModal({ reservation, onClose, onSubmitted }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('Pelayanannya cepat dan hasilnya rapi.')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    setLoading(true); setError('')
    try { await api('/customer/ratings', { method: 'POST', body: { reservationId: reservation.id, stars: rating, comment } }); setSent(true); onSubmitted() }
    catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }
  return (
    <Modal onClose={onClose}>
      {sent ? <div className="modal-result"><span><Check size={28} /></span><h2>Terima kasih!</h2><p>Rating Anda membantu kami menjaga kualitas layanan.</p><button className="button button--gold" onClick={onClose}>Selesai</button></div> : <>
        <div className="modal-heading"><span className="modal-heading__icon"><CheckCircle2 size={25} /></span><p className="eyebrow">Layanan selesai</p><h2>Bagaimana pengalaman Anda?</h2><p>{reservation.service} oleh {reservation.barber} • {reservation.number}</p></div>
        <Stars value={rating} onChange={setRating} size={31} />
        <label className="textarea-label">Komentar<textarea rows="4" value={comment} onChange={(e) => setComment(e.target.value)} /></label>
        {error && <div className="form-error">{error}</div>}
        <button className="button button--gold button--full" disabled={loading} onClick={submit}>{loading ? 'Mengirim…' : 'Kirim rating'}</button>
      </>}
    </Modal>
  )
}

function AdminApp({ user, onLogout }) {
  const [active, setActive] = useState('dashboard')
  const [queues, setQueues] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [master, setMaster] = useState(null)
  const [waitlist, setWaitlist] = useState([])
  const [selectedQueue, setSelectedQueue] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editCategory, setEditCategory] = useState(null)
  const [error, setError] = useState('')
  const [waitlistNotice, setWaitlistNotice] = useState('')
  const [activatingWaitlistId, setActivatingWaitlistId] = useState(null)
  const meta = pageMeta.admin[active] || pageMeta.admin.dashboard

  const loadAdmin = useCallback(async () => {
    try {
      const [dashboardData, queueData, masterData, waitlistData] = await Promise.all([api('/admin/dashboard'), api('/admin/queue'), api('/admin/master'), api('/admin/waitlist')])
      setDashboard(dashboardData); setQueues(queueData.queue); setMaster(masterData); setWaitlist(waitlistData.waitlist); setError('')
    } catch (requestError) { setError(requestError.message) }
  }, [])
  useEffect(() => { loadAdmin() }, [loadAdmin])
  useEffect(() => subscribeToEvents(() => loadAdmin()), [loadAdmin])

  const openSaw = (queue = queues[0]) => { if (queue) { setSelectedQueue(queue); setActive('saw') } }
  const updateStatus = async (id, status) => {
    try {
      const result = await api(`/admin/reservations/${id}/status`, { method: 'PATCH', body: { status } })
      setQueues(result.queue); loadAdmin()
    } catch (requestError) { setError(requestError.message) }
  }
  const activateWaitlist = async (id) => {
    if (activatingWaitlistId !== null) return
    setActivatingWaitlistId(id)
    setError('')
    setWaitlistNotice('')
    try {
      await api(`/admin/waitlist/${id}/activate`, { method: 'POST' })
      await loadAdmin()
      setWaitlistNotice('Waitlist berhasil diubah menjadi reservasi.')
    } catch (requestError) {
      await loadAdmin()
      setError(requestError.message)
    } finally {
      setActivatingWaitlistId(null)
    }
  }

  return (
    <AppShell role="admin" user={user} active={active} onNavigate={setActive} onLogout={onLogout} title={meta[0]} subtitle={meta[1]} action={<button className="button button--gold" onClick={() => setAddOpen(true)}><Plus size={17} /> Tambah data</button>}>
      {error && <div className="page-error">{error}<button onClick={loadAdmin}>Coba lagi</button></div>}
      {!dashboard || !master ? <ContentLoader /> : <>
      {active === 'dashboard' && <AdminDashboard data={dashboard} onNavigate={setActive} openSaw={openSaw} />}
      {active === 'queues' && <AdminQueues queues={queues} waitlist={waitlist} updateStatus={updateStatus} activateWaitlist={activateWaitlist} activatingWaitlistId={activatingWaitlistId} waitlistNotice={waitlistNotice} openSaw={openSaw} />}
      {active === 'saw' && selectedQueue && <SawDetail queue={selectedQueue} ranking={queues} onBack={() => setActive('queues')} />}
      {active === 'master' && <MasterData data={master} onAdd={() => setAddOpen(true)} onEdit={setEditCategory} />}
      {active === 'reports' && <Reports />}
      </>}
      {addOpen && <AddDataModal onClose={() => setAddOpen(false)} onSaved={loadAdmin} />}
      {editCategory && <MasterEditModal category={editCategory} data={master} onClose={() => setEditCategory(null)} onSaved={loadAdmin} />}
    </AppShell>
  )
}

function AdminDashboard({ data, onNavigate, openSaw }) {
  const { summary, activity, queue } = data
  const maxActivity = Math.max(...activity.map((item) => item.count), 1)
  return (
    <div className="stack-xl">
      <section className="stats-grid stats-grid--four">
        <StatCard icon={CalendarCheck2} label="Total reservasi" value={summary.total || 0} trend="Data hari ini" />
        <StatCard icon={ListOrdered} label="Sedang menunggu" value={summary.waiting || 0} tone="blue" trend="Antrian aktif" />
        <StatCard icon={Scissors} label="Layanan selesai" value={summary.completed || 0} tone="green" trend={`${summary.total ? Math.round((summary.completed / summary.total) * 100) : 0}% dari total`} />
        <StatCard icon={CircleDollarSign} label="Pendapatan" value={formatCurrency(summary.revenue || 0)} tone="purple" trend="Transaksi selesai" />
      </section>
      <div className="admin-dashboard-grid">
        <section className="panel">
          <div className="panel__header"><div><p className="eyebrow">Aktivitas hari ini</p><h2>Alur reservasi</h2></div><span className="auto-refresh"><TimerReset size={15} /> 7 hari terakhir</span></div>
          <div className="chart-area">
            {activity.map((item) => <div key={item.date}><span style={{ height: `${Math.max(8, (item.count / maxActivity) * 100)}%` }}><i>{item.count}</i></span><small>{new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(new Date(`${item.date}T00:00:00+08:00`))}</small></div>)}
          </div>
        </section>
        <section className="panel quick-menu">
          <div className="panel__header"><div><p className="eyebrow">Menu admin</p><h2>Akses cepat</h2></div></div>
          <button onClick={() => onNavigate('queues')}><span><ListChecks size={20} /></span><div><strong>Kelola antrian</strong><small>Pantau status dan prioritas SAW</small></div><ChevronRight size={18} /></button>
          <button onClick={() => onNavigate('master')}><span><UsersRound size={20} /></span><div><strong>Data master</strong><small>Layanan, barber, jadwal, member</small></div><ChevronRight size={18} /></button>
          <button onClick={() => onNavigate('reports')}><span><BarChart3 size={20} /></span><div><strong>Laporan transaksi</strong><small>Rekap dan ekspor laporan berkala</small></div><ChevronRight size={18} /></button>
        </section>
      </div>
      <section className="panel">
        <div className="panel__header"><div><p className="eyebrow">Antrian terbaru</p><h2>Pelanggan berikutnya</h2></div><button className="text-button" onClick={() => onNavigate('queues')}>Lihat semua <ArrowRight size={16} /></button></div>
        <QueueAdminTable queues={queue.slice(0, 4)} openSaw={openSaw} />
      </section>
    </div>
  )
}

function QueueAdminTable({ queues, updateStatus, openSaw }) {
  return (
    <div className="admin-table">
      <div className="admin-table__head"><span>Antrian</span><span>Pelanggan</span><span>Layanan</span><span>Skor SAW</span><span>Status</span><span /></div>
      {queues.map((queue) => (
        <div key={queue.number}>
          <strong>{queue.number}</strong>
          <span><b>{queue.name}</b><small>{queue.time} WITA • {queue.barber}</small></span>
          <span>{queue.service}</span>
          <span className="score-pill">{queue.score.toFixed(2)}</span>
          {updateStatus ? <select value={queue.status} onChange={(e) => updateStatus(queue.id, e.target.value)}><option>Menunggu</option><option>Giliran Anda</option><option>Proses</option><option>Selesai</option><option>No-show</option><option>Dibatalkan</option></select> : <StatusBadge status={queue.status} />}
          <button className="table-action" onClick={() => openSaw?.(queue)}>Detail</button>
        </div>
      ))}
    </div>
  )
}

function AdminQueues({ queues, waitlist, updateStatus, activateWaitlist, activatingWaitlistId, waitlistNotice, openSaw }) {
  const [filter, setFilter] = useState('Semua')
  const filteredQueues = filter === 'Semua' ? queues : queues.filter((item) => item.status === filter)
  return (
    <div className="stack-xl"><section className="panel">
      <div className="panel__header"><div><p className="eyebrow">Prioritas real-time</p><h2>Daftar antrian hari ini</h2></div><div className="filter-row">{['Semua', 'Menunggu', 'Proses'].map((item) => <button key={item} className={`filter-chip ${filter === item ? 'is-active' : ''}`} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
      <div className="admin-note"><ShieldCheck size={20} /><p>Urutan antrian dihitung otomatis berdasarkan status member, jenis layanan, dan ketepatan waktu.</p></div>
      <QueueAdminTable queues={filteredQueues} updateStatus={updateStatus} openSaw={openSaw} />
    </section><section className="panel"><div className="panel__header"><div><p className="eyebrow">Waitlist digital</p><h2>Daftar tunggu slot penuh</h2></div><span className="status">{waitlist.length} menunggu</span></div>{waitlistNotice && <div className="admin-note"><CheckCircle2 size={20} /><p>{waitlistNotice}</p></div>}{waitlist.length ? <div className="waitlist-admin-list">{waitlist.map((item) => <article key={item.id}><span><TimerReset size={18} /></span><div><strong>{item.customer}</strong><small>{item.service} • {item.barber} • {formatBookingDate(item.date)} {item.time}</small><small>{item.activationMessage}</small></div><StatusBadge status={item.status} /><button className="button button--outline" disabled={!item.canActivate || activatingWaitlistId !== null} title={item.activationMessage} onClick={() => activateWaitlist(item.id)}>{activatingWaitlistId === item.id ? 'Mengaktifkan…' : item.canActivate ? 'Aktifkan slot' : 'Slot masih penuh'}</button></article>)}</div> : <div className="notification-empty">Tidak ada pelanggan dalam waitlist aktif.</div>}</section></div>
  )
}

function SawDetail({ queue, ranking, onBack }) {
  return (
    <div className="saw-detail-layout">
      <section className="panel saw-detail">
        <button className="back-link" onClick={onBack}><ArrowLeft size={17} /> Kembali ke antrian</button>
        <div className="saw-person"><span>{queue.name.charAt(0)}</span><div><p className="eyebrow">Alternatif: {queue.number}</p><h2>{queue.name}</h2><small>{queue.service} • {queue.barber}</small></div><StatusBadge status="Prioritas Tinggi" /></div>
        <table><thead><tr><th>Kode</th><th>Kriteria</th><th>Nilai</th><th>Bobot</th><th>Normalisasi</th></tr></thead><tbody><tr><td>C1</td><td>Status member</td><td>{queue.criteria.memberRaw}</td><td>0.40</td><td>{queue.criteria.member.toFixed(2)}</td></tr><tr><td>C2</td><td>Jenis layanan</td><td>{queue.criteria.serviceRaw}</td><td>0.35</td><td>{queue.criteria.service.toFixed(2)}</td></tr><tr><td>C3</td><td>Ketepatan waktu</td><td>{queue.criteria.punctualityRaw}</td><td>0.25</td><td>{queue.criteria.punctuality.toFixed(2)}</td></tr></tbody></table>
        <div className="formula"><p>Nilai preferensi • {queue.sawStatus === 'final' ? 'Final (sudah check-in)' : 'Provisional (belum check-in)'}</p><code>V = ({queue.criteria.member.toFixed(2)} × 0.40) + ({queue.criteria.service.toFixed(2)} × 0.35) + ({queue.criteria.punctuality.toFixed(2)} × 0.25)</code><strong>{queue.score.toFixed(2)}</strong></div>
      </section>
      <aside className="panel ranking-card"><p className="eyebrow">Peringkat hari ini</p><h2>Urutan prioritas</h2>{[...ranking].sort((a, b) => b.score - a.score).slice(0, 5).map((item, index) => <div className={item.id === queue.id ? 'is-selected' : ''} key={item.id}><b>{index + 1}</b><span><strong>{item.number} • {item.name}</strong><small>Skor {item.score.toFixed(2)}</small></span></div>)}<p className="ranking-card__note">Skor lebih tinggi mendapatkan prioritas pelayanan lebih dahulu.</p></aside>
    </div>
  )
}

function MasterData({ data, onAdd, onEdit }) {
  const items = [
    { id: 'barbers', title: 'Data barber', value: `${data.barbers.filter((item) => item.active).length} barber aktif`, icon: Scissors, color: 'gold' },
    { id: 'services', title: 'Data layanan', value: `${data.services.filter((item) => item.active).length} jenis layanan`, icon: Sparkles, color: 'green' },
    { id: 'schedule', title: 'Jadwal kerja', value: 'Kelola shift setiap barber', icon: CalendarDays, color: 'blue' },
    { id: 'members', title: 'Data member', value: `${data.members.length} pelanggan`, icon: UsersRound, color: 'purple' },
    { id: 'prices', title: 'Harga layanan', value: data.services.length ? `${formatCurrency(Math.min(...data.services.map((item) => item.price)))} – ${formatCurrency(Math.max(...data.services.map((item) => item.price)))}` : 'Belum ada layanan', icon: CircleDollarSign, color: 'gold' },
  ]
  return (
    <section>
      <PageIntro eyebrow="Pusat data" title="Kelola data operasional" description="Pilih kategori untuk melihat dan mengubah informasi." action={<button className="button button--gold" onClick={onAdd}><Plus size={17} /> Tambah data</button>} />
      <div className="master-grid">{items.map(({ id, title, value, icon: Icon, color }) => <article key={id}><span className={`tone-${color}`}><Icon size={23} /></span><div><h3>{title}</h3><p>{value}</p></div><button onClick={() => onEdit(id)}>Edit <ChevronRight size={16} /></button></article>)}</div>
    </section>
  )
}

function MasterEditModal({ category, data, onClose, onSaved }) {
  const isService = ['services', 'prices'].includes(category)
  const source = isService ? data.services : category === 'members' ? data.members : data.barbers
  const [selectedId, setSelectedId] = useState(source[0]?.id || '')
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const selected = source.find((item) => String(item.id) === String(selectedId))

  useEffect(() => {
    if (!selected) return
    setForm(isService ? {
      name: selected.name, description: selected.description, duration: selected.duration, price: selected.price, sawValue: selected.saw_value || 2, active: Boolean(selected.active),
    } : {
      name: selected.name, phone: selected.phone || '', membership: selected.membership || 'Regular', specialty: selected.specialty || '', shiftStart: selected.shiftStart || '09:00', shiftEnd: selected.shiftEnd || '17:00', active: selected.active !== 0,
    })
  }, [selectedId, category])

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }))
  const save = async () => {
    if (!selected) return
    setLoading(true); setError('')
    try {
      await api(isService ? `/admin/services/${selected.id}` : `/admin/users/${selected.id}`, { method: 'PATCH', body: { ...form, duration: Number(form.duration), price: Number(form.price), sawValue: Number(form.sawValue) } })
      await onSaved(); onClose()
    } catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }
  const title = { services: 'Data layanan', prices: 'Harga layanan', barbers: 'Data barber', schedule: 'Jadwal kerja', members: 'Data member' }[category]
  return (
    <Modal onClose={onClose} wide>
      <div className="modal-heading"><span className="modal-heading__icon"><Settings2 size={25} /></span><p className="eyebrow">Data master</p><h2>Edit {title}</h2><p>Perubahan akan langsung dipakai oleh sistem reservasi.</p></div>
      {!source.length ? <div className="form-error">Belum ada data dalam kategori ini.</div> : <div className="master-edit-form">
        <label>Pilih data<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{source.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label>Nama<input value={form.name || ''} onChange={update('name')} /></label>
        {isService ? <>
          <label>Deskripsi<input value={form.description || ''} onChange={update('description')} /></label>
          <div className="form-grid"><label>Durasi (menit)<input type="number" min="10" value={form.duration || ''} onChange={update('duration')} /></label><label>Harga<input type="number" min="0" value={form.price || ''} onChange={update('price')} /></label></div>
          <label>Klasifikasi SAW<select value={form.sawValue || 2} onChange={update('sawValue')}><option value="1">1 — Layanan reguler</option><option value="2">2 — Layanan standar</option><option value="3">3 — Layanan premium / kompleks</option></select></label>
        </> : category === 'members' ? <>
          <label>Nomor telepon<input value={form.phone || ''} onChange={update('phone')} /></label>
          <label>Level member<select value={form.membership || 'Regular'} onChange={update('membership')}><option>Regular</option><option>Silver</option><option>Gold</option></select></label>
        </> : <>
          <label>Spesialisasi<input value={form.specialty || ''} onChange={update('specialty')} /></label>
          <div className="form-grid"><label>Shift mulai<input type="time" value={form.shiftStart || ''} onChange={update('shiftStart')} /></label><label>Shift selesai<input type="time" value={form.shiftEnd || ''} onChange={update('shiftEnd')} /></label></div>
        </>}
        <label className="checkbox-label"><input type="checkbox" checked={form.active ?? true} onChange={update('active')} /> Data aktif</label>
        {error && <div className="form-error">{error}</div>}
        <button className="button button--gold button--full" disabled={loading} onClick={save}>{loading ? 'Menyimpan…' : 'Simpan perubahan'}</button>
      </div>}
    </Modal>
  )
}

function AddDataModal({ onClose, onSaved }) {
  const [type, setType] = useState('Barber')
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const save = async () => {
    setLoading(true); setError('')
    try { await api('/admin/master', { method: 'POST', body: { type, name } }); setSaved(true); onSaved() }
    catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }
  return (
    <Modal onClose={onClose}>
      {saved ? <div className="modal-result"><span><Check size={28} /></span><h2>Data ditambahkan</h2><p>Data baru sudah masuk ke sistem.</p><button className="button button--gold" onClick={onClose}>Selesai</button></div> : <>
        <div className="modal-heading"><span className="modal-heading__icon"><Plus size={25} /></span><p className="eyebrow">Data master</p><h2>Tambah data baru</h2><p>Lengkapi informasi dasar berikut.</p></div>
        <div className="modal-form"><label>Jenis data<select value={type} onChange={(e) => setType(e.target.value)}><option>Barber</option><option>Layanan</option><option>Member</option></select></label><label>Nama data<input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Nama ${type.toLowerCase()}`} /></label></div>
        {error && <div className="form-error">{error}</div>}
        <button className="button button--gold button--full" disabled={!name || loading} onClick={save}>{loading ? 'Menyimpan…' : 'Simpan data'}</button>
      </>}
    </Modal>
  )
}

function Reports() {
  const [period, setPeriod] = useState('Harian')
  const [report, setReport] = useState(null)
  const periodKey = { Harian: 'daily', Mingguan: 'weekly', Bulanan: 'monthly' }[period]
  useEffect(() => { api(`/admin/reports?period=${periodKey}`).then(setReport) }, [periodKey])
  if (!report) return <ContentLoader />
  const maxCount = Math.max(...report.activity.map((item) => item.count), 1)
  const exportReport = () => {
    const rows = [['Periode', report.period], ['Mulai', report.range.start], ['Sampai', report.range.end], [], ['Metrik', 'Nilai'], ['Total reservasi', report.summary.total || 0], ['Layanan selesai', report.summary.completed || 0], ['No-show', report.summary.noShow || 0], ['Pendapatan', report.summary.revenue || 0], [], ['Layanan', 'Reservasi', 'Pendapatan'], ...report.performance.map((item) => [item.name, item.count, item.revenue])]
    const blob = new Blob([rows.map((row) => row.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `laporan-${periodKey}.csv`; link.click(); URL.revokeObjectURL(link.href)
  }
  return (
    <div className="stack-xl">
      <section className="report-controls"><div><p className="eyebrow">Periode laporan</p><div className="segmented">{['Harian', 'Mingguan', 'Bulanan'].map((item) => <button key={item} className={period === item ? 'is-active' : ''} onClick={() => setPeriod(item)}>{item}</button>)}</div></div><button className="button button--dark" onClick={exportReport}><FileDown size={17} /> Ekspor CSV</button></section>
      <section className="stats-grid stats-grid--four"><StatCard icon={CalendarCheck2} label="Total reservasi" value={report.summary.total || 0} /><StatCard icon={CheckCircle2} label="Layanan selesai" value={report.summary.completed || 0} tone="green" /><StatCard icon={TimerReset} label="No-show" value={report.summary.noShow || 0} tone="blue" /><StatCard icon={CircleDollarSign} label="Pendapatan aktual" value={formatCurrency(report.summary.revenue || 0)} tone="purple" /></section>
      <div className="report-grid">
        <section className="panel"><div className="panel__header"><div><p className="eyebrow">Reservasi</p><h2>Aktivitas pada periode ini</h2></div></div><div className="revenue-chart">{report.activity.length ? report.activity.map((item) => <i key={item.date} title={`${item.date}: ${item.count}`} style={{ height: `${Math.max(8, (item.count / maxCount) * 100)}%` }} />) : <p className="chart-empty">Belum ada transaksi</p>}</div><div className="chart-caption"><span>{report.range.start}</span><span>{report.range.end}</span></div></section>
        <section className="panel service-performance"><div className="panel__header"><div><p className="eyebrow">Layanan</p><h2>Performa terbaik</h2></div></div>{report.performance.map((service, index) => <div key={service.id}><span>{index + 1}</span><div><strong>{service.name}</strong><small>{service.count} reservasi</small></div><em>{report.summary.total ? Math.round((service.count / report.summary.total) * 100) : 0}%</em></div>)}</section>
      </div>
    </div>
  )
}

function BarberApp({ user, onLogout }) {
  const [active, setActive] = useState('dashboard')
  const [data, setData] = useState(null)
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const meta = pageMeta.barber[active] || pageMeta.barber.dashboard
  const loadBarber = useCallback(async () => {
    try {
      const result = await api('/barber/dashboard')
      setData(result)
      setSelected((current) => current ? result.queue.find((item) => item.id === current.id) || current : result.queue[0] || null)
      setError('')
    } catch (requestError) { setError(requestError.message) }
  }, [])
  useEffect(() => { loadBarber() }, [loadBarber])
  useEffect(() => subscribeToEvents((type) => { if (type === 'queue-updated') loadBarber() }), [loadBarber])
  const openCustomer = (item) => { setSelected(item); setActive('customers') }
  const setStatus = async (status) => {
    if (!selected) return
    try {
      const { reservation } = await api(`/barber/reservations/${selected.id}/status`, { method: 'PATCH', body: { status } })
      setSelected(reservation); loadBarber()
    } catch (requestError) { setError(requestError.message) }
  }
  const checkIn = async () => {
    if (!selected) return
    try {
      const { reservation } = await api(`/reservations/${selected.id}/check-in`, { method: 'PATCH', body: {} })
      setSelected(reservation); loadBarber()
    } catch (requestError) { setError(requestError.message) }
  }
  return (
    <AppShell role="barber" user={user} active={active} onNavigate={setActive} onLogout={onLogout} title={meta[0]} subtitle={meta[1]}>
      {error && <div className="page-error">{error}<button onClick={loadBarber}>Coba lagi</button></div>}
      {!data ? <ContentLoader /> : <>
      {active === 'dashboard' && <BarberDashboard user={user} data={data} onOpen={openCustomer} />}
      {active === 'customers' && (selected ? <CustomerDetail customer={selected} onStatus={setStatus} onCheckIn={checkIn} /> : <section className="panel">Belum ada pelanggan dalam antrian.</section>)}
      {active === 'schedule' && <BarberSchedule user={user} queue={data.queue} />}
      </>}
    </AppShell>
  )
}

function BarberDashboard({ user, data, onOpen }) {
  const { queue, summary } = data
  return (
    <div className="barber-dashboard">
      <section className="barber-profile-banner"><span>{user.name.charAt(0)}</span><div><p className="eyebrow eyebrow--light">Barber aktif</p><h2>{user.name}</h2><p>{user.specialty} • {summary.remaining} antrian tersisa</p></div><StatusBadge status="Online" /></section>
      <section className="stats-grid stats-grid--three"><StatCard icon={ListOrdered} label="Sisa antrian" value={summary.remaining} /><StatCard icon={Scissors} label="Selesai hari ini" value={summary.completed} tone="green" /><StatCard icon={Clock3} label="Rata-rata layanan" value={summary.averageDuration} suffix=" menit" tone="blue" /></section>
      <section className="panel">
        <div className="panel__header"><div><p className="eyebrow">Antrian berikutnya</p><h2>Jadwal pelayanan Anda</h2></div><span className="auto-refresh"><TimerReset size={15} /> real-time</span></div>
        <div className="barber-queue-list">{queue.filter((item) => !['Selesai', 'No-show'].includes(item.status)).map((item, index) => <button key={item.id} onClick={() => onOpen(item)}><span className="barber-queue-list__order">{String(index + 1).padStart(2, '0')}</span><strong>{item.number}</strong><div><b>{item.name}</b><small>{item.service}</small></div><time>{item.time}</time><StatusBadge status={item.status} /><ChevronRight size={18} /></button>)}</div>
      </section>
    </div>
  )
}

function CustomerDetail({ customer, onStatus, onCheckIn }) {
  const checkedInTime = customer.checkedInAt?.split('T')[1]?.slice(0, 5)
  return (
    <div className="customer-detail-grid">
      <section className="panel customer-identity"><span className="customer-identity__avatar">{customer.name.charAt(0)}</span><div><p className="eyebrow">Member {customer.membership} • {customer.number}</p><h2>{customer.name}</h2><p>Reservasi {formatBookingDate(customer.date)} pukul {customer.time} WITA</p></div><StatusBadge status={customer.status} /><dl><div><dt>Layanan</dt><dd>{customer.service}</dd></div><div><dt>Check-in</dt><dd>{checkedInTime ? `${checkedInTime} WITA` : 'Belum check-in'}</dd></div><div><dt>Skor SAW</dt><dd>{customer.score.toFixed(2)} • {customer.sawStatus === 'final' ? 'Final' : 'Provisional'}</dd></div><div><dt>Nilai C1 / C2 / C3</dt><dd>{customer.criteria.memberRaw} / {customer.criteria.serviceRaw} / {customer.criteria.punctualityRaw}</dd></div><div><dt>Catatan</dt><dd>{customer.notes || 'Tidak ada catatan'}</dd></div></dl></section>
      <section className="panel service-status"><p className="eyebrow">Status pelayanan</p><h2>Perbarui progres</h2><div className="status-timeline"><div className={customer.checkedInAt ? 'is-done' : ''}><span>{customer.checkedInAt ? <Check size={16} /> : '1'}</span><strong>Check-in</strong><small>{checkedInTime ? `Hadir pukul ${checkedInTime}` : 'Catat waktu kedatangan aktual'}</small></div><div className={customer.status === 'Proses' || customer.status === 'Selesai' ? 'is-done' : ''}><span>{customer.status === 'Proses' || customer.status === 'Selesai' ? <Check size={16} /> : '2'}</span><strong>Proses</strong><small>Layanan sedang berjalan</small></div><div className={customer.status === 'Selesai' ? 'is-done' : ''}><span>{customer.status === 'Selesai' ? <Check size={16} /> : '3'}</span><strong>Selesai</strong><small>Siap untuk pembayaran</small></div></div><div className="service-status__actions service-status__actions--extended"><button className="button button--outline" disabled={Boolean(customer.checkedInAt) || ['Selesai', 'No-show'].includes(customer.status)} onClick={onCheckIn}>Check-in pelanggan</button><button className="button button--dark" disabled={!customer.checkedInAt || ['Proses', 'Selesai', 'No-show'].includes(customer.status)} onClick={() => onStatus('Proses')}>Mulai pelayanan</button><button className="button button--gold" disabled={customer.status !== 'Proses'} onClick={() => onStatus('Selesai')}>Tandai selesai</button><button className="button button--danger" disabled={Boolean(customer.checkedInAt) || ['Proses', 'Selesai', 'No-show'].includes(customer.status)} onClick={() => onStatus('No-show')}>Tandai no-show</button></div></section>
    </div>
  )
}

function BarberSchedule({ user, queue }) {
  const today = new Date()
  const week = Array.from({ length: 7 }, (_, index) => { const date = new Date(today); date.setDate(today.getDate() - today.getDay() + 1 + index); return date })
  return (
    <div className="schedule-layout">
      <section className="panel mini-calendar"><div className="panel__header"><div><p className="eyebrow">{new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(today)}</p><h2>Kalender kerja</h2></div></div><div className="calendar-week"><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span><span>Min</span>{week.map((date) => <span className={`calendar-day ${date.toDateString() === today.toDateString() ? 'is-active' : ''}`} key={date.toISOString()}>{date.getDate()}</span>)}</div><div className="shift-card"><Clock3 size={20} /><div><strong>Shift hari ini</strong><p>{user.shiftStart} – {user.shiftEnd} WITA</p></div><StatusBadge status="Aktif" /></div></section>
      <section className="panel"><div className="panel__header"><div><p className="eyebrow">{new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(today)}</p><h2>Reservasi hari ini</h2></div></div><div className="schedule-list">{queue.map((item) => <div key={item.id}><time>{item.time}</time><i /><span><strong>{item.name}</strong><small>{item.service} • {item.number}</small></span><StatusBadge status={item.status} /></div>)}</div></section>
    </div>
  )
}

export default App
