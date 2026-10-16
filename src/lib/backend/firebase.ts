// Production backend: Firebase Auth (Google) and Firestore only, no Cloud Functions.
// The browser writes directly to Firestore; firestore.rules validates every write (prices, slots,
// allowed state changes). Payments use Razorpay Checkout without an order: the payment id is stored
// on the booking and an admin verifies it in the Razorpay dashboard.
// Emails go through the "Trigger Email from Firestore" extension (`mail` collection); WhatsApp
// messages are queued in `outbox` for an admin to send with one tap (wa.me).
import { initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
  type Transaction,
} from 'firebase/firestore'
import { isValidSlot, nowIST, slotKey, type SlotKind } from '../../shared/catalog'
import * as logic from '../../shared/logic'
import type { Booking, OutboxMessage, Slot } from '../../shared/types'
import { ADMIN_NOTIFY_EMAIL, APP_URL, RAZORPAY_KEY_ID, firebaseConfig } from '../config'
import type { AppUser, Backend } from './types'

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = initializeFirestore(app, { ignoreUndefinedProperties: true })

const bookings = collection(db, 'bookings')
const bookingRef = (id: string) => doc(bookings, id)
const slotRef = (kind: SlotKind, s: Slot) => doc(db, 'slots', slotKey(kind, s.date, s.time))

const TAKEN = 'Sorry, that slot was just taken. Please pick another.'

function requireUser() {
  const u = auth.currentUser
  if (!u) throw new Error('Please sign in first')
  return u
}

/** Turns Firestore errors into readable messages. A rules rejection means the write was not allowed. */
async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if ((e as { code?: string }).code === 'permission-denied')
      throw new Error('That action is not allowed. Please refresh and try again.', { cause: e })
    throw e
  }
}

const isTaken = (s: { bookingId?: string; status?: string; holdUntil?: number } | undefined, bookingId: string) =>
  !!s && s.bookingId !== bookingId && (s.status === 'booked' || (s.holdUntil ?? 0) > Date.now())

/** Reads a slot inside a transaction and throws if someone else holds/booked it. */
async function assertSlotFree(tx: Transaction, ref: DocumentReference, bookingId: string) {
  if (isTaken((await tx.get(ref)).data(), bookingId)) throw new Error(TAKEN)
}

const writeSlot = (tx: Transaction, kind: SlotKind, s: Slot, bookingId: string, status: 'held' | 'booked', holdUntil?: number) =>
  tx.set(slotRef(kind, s), { kind, date: s.date, time: s.time, bookingId, status, holdUntil })

async function getOwnBooking(tx: Transaction, id: string, uid: string) {
  const b = (await tx.get(bookingRef(id))).data() as Booking | undefined
  if (!b || b.uid !== uid) throw new Error('Booking not found')
  return b
}

async function findPaidConsultation(uid: string): Promise<string | undefined> {
  const q = query(
    bookings,
    where('uid', '==', uid),
    where('product', '==', 'consultation'),
    where('paymentStatus', '==', 'paid'),
    limit(1),
  )
  return (await getDocs(q)).docs[0]?.id
}

/**
 * Queues notifications: emails become `mail` docs for the Trigger Email extension, WhatsApp
 * messages wait in `outbox` for an admin. Everything is logged to `outbox`.
 * Failures are logged but never fail the user's action.
 */
async function dispatch(b: Booking, notifications: logic.Notification[]) {
  const at = Date.now()
  await Promise.all(
    notifications.flatMap((n) =>
      n.channels.map(async (channel) => {
        const to = n.to === 'admin' ? ADMIN_NOTIFY_EMAIL : channel === 'email' ? b.customer.email : b.customer.phone
        if (!to || (n.to === 'admin' && channel === 'whatsapp')) return
        const { subject, body } = n.message
        // One batch per message, so a rejected recipient doesn't block the others.
        const batch = writeBatch(db)
        if (channel === 'email') batch.set(doc(collection(db, 'mail')), { to, bookingId: b.id, message: { subject, text: body } })
        batch.set(doc(collection(db, 'outbox')), {
          channel,
          to,
          subject,
          body,
          bookingId: b.id,
          at,
          ...(channel === 'whatsapp' ? { status: 'pending' } : {}),
        })
        try {
          await batch.commit()
        } catch (e) {
          console.error('Could not queue notification', { channel, to, bookingId: b.id }, e)
        }
      }),
    ),
  )
}

interface RazorpayResponse {
  razorpay_payment_id: string
}

declare global {
  interface Window {
    Razorpay?: new (opts: object) => { open(): void; on(event: string, cb: (r: { error: { description: string } }) => void): void }
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Could not load the payment gateway. Check your connection.'))
    document.body.appendChild(s)
  })
}

/** Opens Razorpay Checkout and resolves with the payment id once the customer has paid. */
async function collectPayment(b: Booking): Promise<string> {
  if (!RAZORPAY_KEY_ID) throw new Error('Payments are not configured yet (VITE_RAZORPAY_KEY_ID).')
  await loadRazorpay()
  return new Promise<string>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: RAZORPAY_KEY_ID,
      amount: b.amount * 100, // paise
      currency: 'INR',
      name: 'Aaina',
      description: 'Booking ' + b.id,
      notes: { bookingId: b.id, product: b.product }, // shown in the Razorpay dashboard for verification
      prefill: { name: b.customer.name, email: b.customer.email, contact: b.customer.phone },
      theme: { color: '#B76E79' },
      handler: (resp: RazorpayResponse) => resolve(resp.razorpay_payment_id),
      modal: { ondismiss: () => reject(new Error('Payment was cancelled')) },
    })
    rzp.on('payment.failed', (r) => reject(new Error(r.error.description)))
    rzp.open()
  })
}

/** Marks a booking paid (idempotent) and books its slot. */
async function finalizePayment(bookingId: string, paymentRef: string) {
  const uid = requireUser().uid
  const t = await runTransaction(db, async (tx) => {
    const b = await getOwnBooking(tx, bookingId, uid)
    if (b.paymentStatus === 'paid') return null
    if (b.consultation) {
      const sRef = slotRef('consultation', b.consultation)
      if (isTaken((await tx.get(sRef)).data(), bookingId)) {
        // Paid after the hold expired and someone else took the slot: keep the payment, ask to reschedule.
        b.consultation = { ...b.consultation, status: 'reschedule-requested', note: 'Your hold expired before payment.' }
      } else writeSlot(tx, 'consultation', b.consultation, bookingId, 'booked')
    }
    const t = logic.markPaid(b, paymentRef, APP_URL, Date.now())
    tx.set(bookingRef(bookingId), t.booking)
    return t
  })
  if (t) await dispatch(t.booking, t.notify)
}

const toUser = (u: { uid: string; displayName: string | null; email: string | null; photoURL: string | null }): AppUser => ({
  uid: u.uid,
  name: u.displayName || u.email || 'Guest',
  email: u.email || '',
  photoURL: u.photoURL || undefined,
})

const withId = (d: { id: string; data(): object }) => ({ ...d.data(), id: d.id }) as Booking

export const firebaseBackend: Backend = {
  mode: 'firebase',

  onAuthChange(cb) {
    return onAuthStateChanged(auth, (u) => cb(u ? toUser(u) : null))
  },

  async signInWithGoogle() {
    await signInWithPopup(auth, new GoogleAuthProvider())
  },

  async signOut() {
    await signOut(auth)
  },

  watchTakenSlots(kind, cb) {
    const q = query(collection(db, 'slots'), where('kind', '==', kind), where('date', '>=', nowIST().date))
    return onSnapshot(q, (snap) => {
      const now = Date.now()
      const taken = new Set<string>()
      snap.forEach((d) => {
        const s = d.data() as { date: string; time: string; status: string; holdUntil?: number }
        if (s.status === 'booked' || (s.holdUntil ?? 0) > now) taken.add(slotKey(kind, s.date, s.time))
      })
      cb(taken)
    })
  },

  async hasPaidConsultation() {
    const uid = auth.currentUser?.uid
    return uid ? !!(await findPaidConsultation(uid)) : false
  },

  createBooking: ({ product, slot, name, phone }) =>
    guard(async () => {
      const user = requireUser()
      if (slot && !isValidSlot('consultation', slot.date, slot.time)) throw new Error('That slot is not available')
      const ref = doc(bookings)
      const booking = logic.createBooking({
        id: ref.id,
        uid: user.uid,
        customer: { name: String(name || user.displayName || '').slice(0, 80), email: user.email ?? '', phone: String(phone ?? '') },
        product,
        slot: slot ? { date: slot.date, time: slot.time } : undefined,
        creditBookingId: await findPaidConsultation(user.uid),
        now: Date.now(),
      })
      await runTransaction(db, async (tx) => {
        if (booking.consultation) {
          await assertSlotFree(tx, slotRef('consultation', booking.consultation), booking.id)
          writeSlot(tx, 'consultation', booking.consultation, booking.id, 'held', booking.holdUntil)
        }
        tx.set(ref, booking)
      })
      return booking.id
    }),

  pay: (bookingId) =>
    guard(async () => {
      const uid = requireUser().uid
      const b = (await getDoc(bookingRef(bookingId))).data() as Booking | undefined
      if (!b || b.uid !== uid) throw new Error('Booking not found')
      if (b.paymentStatus === 'paid') return
      const paymentId = await collectPayment(b)
      await finalizePayment(bookingId, paymentId)
    }),

  watchBooking(id, cb) {
    return onSnapshot(
      bookingRef(id),
      (d) => cb(d.exists() ? withId(d) : null),
      () => cb(null),
    )
  },

  watchMyBookings(cb) {
    const uid = auth.currentUser?.uid
    if (!uid) {
      cb([])
      return () => {}
    }
    return onSnapshot(query(bookings, where('uid', '==', uid)), (snap) =>
      cb(snap.docs.map(withId).sort((a, b) => b.createdAt - a.createdAt)),
    )
  },

  rescheduleConsultation: (bookingId, slot) =>
    guard(async () => {
      const uid = requireUser().uid
      if (!isValidSlot('consultation', slot.date, slot.time)) throw new Error('That slot is not available')
      const t = await runTransaction(db, async (tx) => {
        const b = await getOwnBooking(tx, bookingId, uid)
        await assertSlotFree(tx, slotRef('consultation', slot), b.id)
        const t = logic.rescheduleConsultation(b, slot, APP_URL, Date.now())
        writeSlot(tx, 'consultation', slot, b.id, 'booked')
        tx.set(bookingRef(b.id), t.booking)
        return t
      })
      await dispatch(t.booking, t.notify)
    }),

  bookDelivery: (bookingId, slot, address) =>
    guard(async () => {
      const uid = requireUser().uid
      if (!isValidSlot('delivery', slot.date, slot.time)) throw new Error('That slot is not available')
      const t = await runTransaction(db, async (tx) => {
        const b = await getOwnBooking(tx, bookingId, uid)
        await assertSlotFree(tx, slotRef('delivery', slot), b.id)
        const t = logic.bookDelivery(b, slot, String(address ?? '').slice(0, 400), APP_URL, Date.now())
        writeSlot(tx, 'delivery', slot, b.id, 'booked')
        tx.set(bookingRef(b.id), t.booking)
        return t
      })
      await dispatch(t.booking, t.notify)
    }),

  watchAllBookings(cb) {
    return onSnapshot(query(bookings, where('paymentStatus', '==', 'paid')), (snap) =>
      cb(snap.docs.map(withId).sort((a, b) => b.createdAt - a.createdAt)),
    )
  },

  adminAction: (bookingId, action) =>
    guard(async () => {
      const t = await runTransaction(db, async (tx) => {
        const b = (await tx.get(bookingRef(bookingId))).data() as Booking | undefined
        if (!b) throw new Error('Booking not found')
        const t = logic.applyAdminAction(b, action, APP_URL, Date.now())
        // Asking the customer to pick another time frees their original slot.
        if (action.type === 'request-reschedule' && b.consultation) tx.delete(slotRef('consultation', b.consultation))
        tx.set(bookingRef(bookingId), t.booking)
        return t
      })
      await dispatch(t.booking, t.notify)
    }),

  watchOutbox(cb) {
    return onSnapshot(query(collection(db, 'outbox'), orderBy('at', 'desc'), limit(100)), (snap) =>
      cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as OutboxMessage)),
    )
  },

  markWhatsAppSent: (messageId) => guard(() => updateDoc(doc(db, 'outbox', messageId), { status: 'sent' })),

  markReminderSent: (bookingId, kind) => guard(() => updateDoc(bookingRef(bookingId), { [`reminders.${kind}`]: true })),
}
