// Production backend: Firebase Auth (Google), Firestore (reads), Cloud Functions (all writes),
// Razorpay for payments. See functions/ for the server side.
import { initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { nowIST, slotKey } from '../../shared/catalog'
import type { Booking, OutboxMessage } from '../../shared/types'
import { FUNCTIONS_REGION, firebaseConfig } from '../config'
import type { AppUser, Backend } from './types'

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)
const fns = getFunctions(app, FUNCTIONS_REGION)

function call<I, O = unknown>(name: string) {
  const fn = httpsCallable<I, O>(fns, name)
  return async (input: I) => {
    try {
      return (await fn(input)).data
    } catch (e) {
      throw new Error((e as Error).message.replace(/^.*?:\s*/, '') || 'Something went wrong', { cause: e })
    }
  }
}

const api = {
  createBooking: call<object, { bookingId: string }>('createBooking'),
  createPaymentOrder: call<{ bookingId: string }, RazorpayOrder>('createPaymentOrder'),
  verifyPayment: call<object>('verifyPayment'),
  rescheduleConsultation: call<object>('rescheduleConsultation'),
  bookDelivery: call<object>('bookDelivery'),
  adminAction: call<object>('adminAction'),
}

interface RazorpayOrder {
  orderId: string
  amount: number
  currency: string
  keyId: string
  customer: { name: string; email: string; phone: string }
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
    if (!uid) return false
    const q = query(
      collection(db, 'bookings'),
      where('uid', '==', uid),
      where('product', '==', 'consultation'),
      where('paymentStatus', '==', 'paid'),
      limit(1),
    )
    return !(await getDocs(q)).empty
  },

  async createBooking(input) {
    return (await api.createBooking(input)).bookingId
  },

  async pay(bookingId) {
    const order = await api.createPaymentOrder({ bookingId })
    await loadRazorpay()
    await new Promise<void>((resolve, reject) => {
      const rzp = new window.Razorpay!({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'Aaina',
        description: 'Booking ' + bookingId,
        prefill: { name: order.customer.name, email: order.customer.email, contact: order.customer.phone },
        theme: { color: '#B76E79' },
        handler: (resp: Record<string, string>) =>
          api.verifyPayment({ bookingId, ...resp }).then(() => resolve(), reject),
        modal: { ondismiss: () => reject(new Error('Payment was cancelled')) },
      })
      rzp.on('payment.failed', (r) => reject(new Error(r.error.description)))
      rzp.open()
    })
  },

  watchBooking(id, cb) {
    return onSnapshot(
      doc(db, 'bookings', id),
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
    return onSnapshot(query(collection(db, 'bookings'), where('uid', '==', uid)), (snap) =>
      cb(snap.docs.map(withId).sort((a, b) => b.createdAt - a.createdAt)),
    )
  },

  async rescheduleConsultation(bookingId, slot) {
    await api.rescheduleConsultation({ bookingId, ...slot })
  },

  async bookDelivery(bookingId, slot, address) {
    await api.bookDelivery({ bookingId, ...slot, address })
  },

  watchAllBookings(cb) {
    return onSnapshot(query(collection(db, 'bookings'), where('paymentStatus', '==', 'paid')), (snap) =>
      cb(snap.docs.map(withId).sort((a, b) => b.createdAt - a.createdAt)),
    )
  },

  async adminAction(bookingId, action) {
    await api.adminAction({ bookingId, action })
  },

  watchOutbox(cb) {
    return onSnapshot(query(collection(db, 'outbox'), orderBy('at', 'desc'), limit(100)), (snap) =>
      cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as OutboxMessage)),
    )
  },
}

