import React, { useEffect, useState } from 'react'
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Clock3,
  Database,
  FileBarChart,
  History,
  Home,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Settings2,
  Star,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { api, subscribeToEvents } from './api'

export const roleConfig = {
  customer: {
    eyebrow: 'Member Area',
    nav: [
      { id: 'home', label: 'Beranda', icon: Home },
      { id: 'queue', label: 'Antrian Saya', icon: ListOrdered },
      { id: 'history', label: 'Riwayat', icon: History },
      { id: 'profile', label: 'Profil', icon: UserRound },
    ],
  },
  admin: {
    eyebrow: 'Admin Workspace',
    nav: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'queues', label: 'Kelola Antrian', icon: ListOrdered },
      { id: 'master', label: 'Data Master', icon: Database },
      { id: 'reports', label: 'Laporan', icon: FileBarChart },
    ],
  },
  barber: {
    eyebrow: 'Barber Workspace',
    nav: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'customers', label: 'Detail Pelanggan', icon: UsersRound },
      { id: 'schedule', label: 'Jadwal Saya', icon: CalendarDays },
    ],
  },
}

export function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`}>
      <img className="brand__logo" src="/logo-parepare.jpg" alt="Logo Pangkas Rambut Anda" />
      <span>
        <strong>Pangkas Rambut Anda</strong>
        {!compact && <small>Smart Reservation • Est. 2010</small>}
      </span>
    </div>
  )
}

export function AppShell({ role, user, active, onNavigate, onLogout, children, title, subtitle, action }) {
  const config = roleConfig[role]
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    let mounted = true
    const load = () => api('/notifications').then((result) => { if (mounted) setNotifications(result.notifications) }).catch(() => {})
    load()
    const unsubscribe = subscribeToEvents((type, payload) => {
      if (type === 'notification-created' && payload.userId === user?.id) load()
    })
    return () => { mounted = false; unsubscribe() }
  }, [user?.id])

  const toggleNotifications = async () => {
    const next = !notificationsOpen
    setNotificationsOpen(next)
    if (next) {
      const unread = notifications.filter((item) => !item.readAt)
      await Promise.all(unread.map((item) => api(`/notifications/${item.id}/read`, { method: 'PATCH' }).catch(() => null)))
      if (unread.length) setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })))
    }
  }
  return (
    <div className={`app-shell app-shell--${role}`}>
      <aside className="sidebar">
        <Brand />
        <div className="sidebar__role">{config.eyebrow}</div>
        <nav className="sidebar__nav">
          {config.nav.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={`nav-item ${active === item.id ? 'is-active' : ''}`}
                key={item.id}
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
                {active === item.id && <ChevronRight className="nav-item__arrow" size={16} />}
              </button>
            )
          })}
        </nav>
        <div className="sidebar__footer">
          <div className="sidebar__help">
            <span className="sidebar__help-icon"><Settings2 size={18} /></span>
            <div><strong>Butuh bantuan?</strong><small>Hubungi kasir kami</small></div>
          </div>
          <button className="nav-item nav-item--logout" onClick={onLogout}><LogOut size={18} /> Keluar</button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">{config.eyebrow}</p>
            <h1>{title}</h1>
            {subtitle && <p className="topbar__subtitle">{subtitle}</p>}
          </div>
          <div className="topbar__actions">
            {action}
            <button className="icon-button" aria-label="Notifikasi" onClick={toggleNotifications}><Bell size={20} />{notifications.some((item) => !item.readAt) && <i />}</button>
            <div className="profile-pill">
              <span className="avatar">{user?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'U'}</span>
              <div><strong>{user?.name || 'Pengguna'}</strong><small>{role === 'admin' ? 'Pemilik' : role === 'barber' ? user?.specialty || 'Barber' : `${user?.membership || 'Regular'} Member`}</small></div>
            </div>
            {notificationsOpen && <div className="notification-popover"><p className="eyebrow">Notifikasi</p>{notifications.length ? <div className="notification-list">{notifications.slice(0, 5).map((item) => <article key={item.id}><strong>{item.title}</strong><small>{item.message}</small><time>{item.channel}</time></article>)}</div> : <div className="notification-empty">Belum ada notifikasi.</div>}</div>}
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  )
}

export function PageIntro({ eyebrow, title, description, action }) {
  return (
    <div className="page-intro">
      <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{description && <p>{description}</p>}</div>
      {action}
    </div>
  )
}

export function StatCard({ icon: Icon, label, value, suffix, tone = 'gold', trend }) {
  return (
    <article className="stat-card">
      <span className={`stat-card__icon tone-${tone}`}><Icon size={22} /></span>
      <div><p>{label}</p><strong>{value}<small>{suffix}</small></strong>{trend && <span className="trend">{trend}</span>}</div>
    </article>
  )
}

export function StatusBadge({ status }) {
  const key = status.toLowerCase().replaceAll(' ', '-').replaceAll('/', '-')
  return <span className={`status status--${key}`}>{status}</span>
}

export function Modal({ children, onClose, wide = false }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <section className={`modal ${wide ? 'modal--wide' : ''}`} role="dialog" aria-modal="true">
        {onClose && <button className="modal__close" onClick={onClose} aria-label="Tutup"><X size={20} /></button>}
        {children}
      </section>
    </div>
  )
}

export function EmptyState({ icon: Icon = Clock3, title, text, action }) {
  return (
    <div className="empty-state">
      <span><Icon size={28} /></span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

export function Stars({ value, onChange, size = 27 }) {
  return (
    <div className="stars" aria-label={`Rating ${value} dari 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} onClick={() => onChange?.(star)} aria-label={`${star} bintang`}>
          <Star size={size} fill={star <= value ? 'currentColor' : 'transparent'} />
        </button>
      ))}
    </div>
  )
}
