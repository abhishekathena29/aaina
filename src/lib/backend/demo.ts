// Local demo backend: everything lives in localStorage so the full flow (booking → payment →
// admin confirmation → notifications → delivery) can be tried without any cloud setup.
// Open the admin console in a second tab — changes sync across tabs.
import { isValidSlot, slotKey, type SlotKind } from '../../shared/catalog'
import * as logic from '../../shared/logic'
import type { Booking, OutboxMessage } from '../../shared/types'
import { ADMIN_EMAILS, APP_URL } from '../config'
import type { AppUser, Backend } from './types'

interface DB {
  bookings: Record<string, Booking>
  outbox: OutboxMessage[]
}

const DB_KEY = 'aaina-demo-db'
const USER_KEY = 'aaina-demo-user'
const listeners = new Set<() => void>()

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const load = (): DB => read<DB>(DB_KEY, { bookings: {}, outbox: [] })

function save(db: DB) {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
  emit()
}

const emit = () => listeners.forEach((l) => l())

window.addEventListener('storage', (e) => {
  if (e.key === DB_KEY || e.key === USER_KEY) emit()
})

function subscribe(fn: () => void) {
  fn()
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

const currentUser = () => read<AppUser | null>(USER_KEY, null)
const uid = () => 'u' + Math.random().toString(36).slice(2, 10)
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

function requireUser(): AppUser {
  const u = currentUser()
  if (!u) throw new Error('Please sign in first')
  return u
}

function requireAdmin() {
  const u = requireUser()
  if (!ADMIN_EMAILS.includes(u.email.toLowerCase())) throw new Error('Admins only')
}

function takenSlots(db: DB, kind: SlotKind, now = Date.now()): Set<string> {
  const out = new Set<string>()
  for (const b of Object.values(db.bookings)) {
    const live = b.paymentStatus === 'paid' || (b.holdUntil ?? 0) > now
    if (!live) continue
    if (kind === 'consultation' && b.consultation && b.consultation.status !== 'reschedule-requested')
      out.add(slotKey('consultation', b.consultation.date, b.consultation.time))
    if (kind === 'delivery' && b.delivery?.date) out.add(slotKey('delivery', b.delivery.date, b.delivery.time!))
  }
  return out
}

function assertSlotFree(db: DB, kind: SlotKind, date: string, time: string, ignoreBooking?: string) {
  if (!isValidSlot(kind, date, time)) throw new Error('That slot is not available')
  const others = { ...db, bookings: { ...db.bookings } }
  if (ignoreBooking) delete others.bookings[ignoreBooking]
  if (takenSlots(others, kind).has(slotKey(kind, date, time))) throw new Error('Sorry, that slot was just taken. Please pick another.')
}

/** Persist a transition and "send" its notifications into the outbox. */
function commit(db: DB, t: logic.Transition) {
  db.bookings[t.booking.id] = t.booking
  for (const n of t.notify) {
    for (const channel of n.channels) {
      const to =
        n.to === 'admin'
          ? ADMIN_EMAILS[0]
          : channel === 'email'
            ? t.booking.customer.email
            : t.booking.customer.phone
      db.outbox.unshift({ id: uid(), channel, to, subject: n.message.subject, body: n.message.body, bookingId: t.booking.id, at: Date.now() })
    }
  }
  save(db)
}

const hasPaidConsultation = (db: DB, userId: string) =>
  Object.values(db.bookings).some((b) => b.uid === userId && b.product === 'consultation' && b.paymentStatus === 'paid')

const sortNewest = (list: Booking[]) => list.sort((a, b) => b.createdAt - a.createdAt)

export const demoBackend: Backend = {
  mode: 'demo',

  onAuthChange(cb) {
    return subscribe(() => cb(currentUser()))
  },

  async signInWithGoogle(profile) {
    await delay(400)
    const p = profile ?? { name: 'Demo Patient', email: 'patient@aaina.demo' }
    const user: AppUser = { uid: 'demo-' + p.email.toLowerCase().replace(/[^a-z0-9]/g, '-'), ...p }
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    emit()
  },

  async signOut() {
    localStorage.removeItem(USER_KEY)
    emit()
  },

  watchTakenSlots(kind, cb) {
    const tick = () => cb(takenSlots(load(), kind))
    const timer = setInterval(tick, 30_000) // holds expire over time
    const unsub = subscribe(tick)
    return () => {
      clearInterval(timer)
      unsub()
    }
  },

  async hasPaidConsultation() {
    return hasPaidConsultation(load(), requireUser().uid)
  },

  async createBooking({ product, slot, name, phone }) {
    const user = requireUser()
    await delay(300)
    const db = load()
    if (slot) assertSlotFree(db, 'consultation', slot.date, slot.time)
    const booking = logic.createBooking({
      id: 'AA' + Date.now().toString(36).toUpperCase(),
      uid: user.uid,
      customer: { name: name || user.name, email: user.email, phone },
      product,
      slot,
      hasPaidConsultation: hasPaidConsultation(db, user.uid),
      now: Date.now(),
    })
    db.bookings[booking.id] = booking
    save(db)
    return booking.id
  },

  async pay(bookingId) {
    await delay(1200) // stand-in for the Razorpay checkout
    const db = load()
    const b = db.bookings[bookingId]
    if (!b) throw new Error('Booking not found')
    if (b.paymentStatus !== 'paid' && (b.holdUntil ?? 0) < Date.now() && b.consultation)
      assertSlotFree(db, 'consultation', b.consultation.date, b.consultation.time, b.id)
    commit(db, logic.markPaid(b, 'demo_pay_' + uid(), APP_URL, Date.now()))
  },

  watchBooking(id, cb) {
    return subscribe(() => {
      const b = load().bookings[id]
      const u = currentUser()
      cb(b && u && (b.uid === u.uid || ADMIN_EMAILS.includes(u.email.toLowerCase())) ? b : null)
    })
  },

  watchMyBookings(cb) {
    return subscribe(() => {
      const u = currentUser()
      cb(u ? sortNewest(Object.values(load().bookings).filter((b) => b.uid === u.uid)) : [])
    })
  },

  async rescheduleConsultation(bookingId, slot) {
    const db = load()
    const b = db.bookings[bookingId]
    if (!b || b.uid !== requireUser().uid) throw new Error('Booking not found')
    assertSlotFree(db, 'consultation', slot.date, slot.time, b.id)
    commit(db, logic.rescheduleConsultation(b, slot, APP_URL, Date.now()))
  },

  async bookDelivery(bookingId, slot, address) {
    const db = load()
    const b = db.bookings[bookingId]
    if (!b || b.uid !== requireUser().uid) throw new Error('Booking not found')
    assertSlotFree(db, 'delivery', slot.date, slot.time)
    commit(db, logic.bookDelivery(b, slot, address, APP_URL, Date.now()))
  },

  watchAllBookings(cb) {
    return subscribe(() => cb(sortNewest(Object.values(load().bookings).filter((b) => b.paymentStatus === 'paid'))))
  },

  async adminAction(bookingId, action) {
    requireAdmin()
    await delay(250)
    const db = load()
    const b = db.bookings[bookingId]
    if (!b) throw new Error('Booking not found')
    commit(db, logic.applyAdminAction(b, action, APP_URL, Date.now()))
  },

  watchOutbox(cb) {
    return subscribe(() => cb(load().outbox))
  },
}
