// Aaina Cloud Functions. All booking writes happen here; clients only read (see firestore.rules).
import crypto from 'node:crypto'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, type DocumentReference, type Transaction } from 'firebase-admin/firestore'
import { logger, setGlobalOptions } from 'firebase-functions'
import { HttpsError, onCall, onRequest, type CallableRequest } from 'firebase-functions/https'
import { defineSecret, defineString } from 'firebase-functions/params'
import { onSchedule } from 'firebase-functions/scheduler'
import Razorpay from 'razorpay'
import { isValidSlot, nowIST, slotKey, type ProductId, type SlotKind } from './shared/catalog'
import * as logic from './shared/logic'
import { messages } from './shared/messages'
import type { AdminAction, Booking, Slot } from './shared/types'
import { APP_URL, NOTIFY_SECRETS, dispatch } from './notify'

initializeApp()
const db = getFirestore()
db.settings({ ignoreUndefinedProperties: true })
setGlobalOptions({ region: 'asia-south1', maxInstances: 10 })

const RAZORPAY_KEY_ID = defineString('RAZORPAY_KEY_ID')
const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET')
const RAZORPAY_WEBHOOK_SECRET = defineSecret('RAZORPAY_WEBHOOK_SECRET')

const bookings = db.collection('bookings')
const slotRef = (kind: SlotKind, s: Slot) => db.collection('slots').doc(slotKey(kind, s.date, s.time))

// ---------- helpers ----------

function requireUser(req: CallableRequest) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Please sign in first')
  return req.auth
}

async function requireAdmin(req: CallableRequest) {
  const auth = requireUser(req)
  const email = auth.token.email
  if (!email || !auth.token.email_verified || !(await db.collection('admins').doc(email).get()).exists)
    throw new HttpsError('permission-denied', 'Admins only')
}

/** Converts domain errors into user-facing HttpsErrors. */
async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof HttpsError) throw e
    if (e instanceof logic.BookingError) throw new HttpsError('failed-precondition', e.message)
    logger.error(e)
    throw new HttpsError('internal', 'Something went wrong. Please try again.')
  }
}

async function getOwnBooking(tx: Transaction, id: string, uid: string) {
  const snap = await tx.get(bookings.doc(id))
  const b = snap.data() as Booking | undefined
  if (!b || b.uid !== uid) throw new HttpsError('not-found', 'Booking not found')
  return b
}

/** Reads a slot inside a transaction and throws if someone else holds/booked it. */
async function assertSlotFree(tx: Transaction, ref: DocumentReference, bookingId: string) {
  const s = (await tx.get(ref)).data()
  if (s && s.bookingId !== bookingId && (s.status === 'booked' || (s.holdUntil ?? 0) > Date.now()))
    throw new HttpsError('already-exists', 'Sorry, that slot was just taken. Please pick another.')
}

const writeSlot = (tx: Transaction, kind: SlotKind, s: Slot, bookingId: string, status: 'held' | 'booked', holdUntil?: number) =>
  tx.set(slotRef(kind, s), { kind, date: s.date, time: s.time, bookingId, status, holdUntil })

async function hasPaidConsultation(uid: string) {
  const q = await bookings
    .where('uid', '==', uid)
    .where('product', '==', 'consultation')
    .where('paymentStatus', '==', 'paid')
    .limit(1)
    .get()
  return !q.empty
}

const razorpay = () => new Razorpay({ key_id: RAZORPAY_KEY_ID.value(), key_secret: RAZORPAY_KEY_SECRET.value() })

const hmac = (secret: string, payload: string) => crypto.createHmac('sha256', secret).update(payload).digest('hex')

const safeEqual = (a: string, b: string) =>
  a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))

/** Marks a booking paid (idempotent) and books its slot. Used by both verifyPayment and the webhook. */
async function finalizePayment(bookingId: string, paymentRef: string) {
  const t = await db.runTransaction(async (tx) => {
    const ref = bookings.doc(bookingId)
    const b = (await tx.get(ref)).data() as Booking | undefined
    if (!b) throw new HttpsError('not-found', 'Booking not found')
    if (b.paymentStatus === 'paid') return null
    if (b.consultation) {
      const sRef = slotRef('consultation', b.consultation)
      const s = (await tx.get(sRef)).data()
      if (s && s.bookingId !== bookingId && (s.status === 'booked' || (s.holdUntil ?? 0) > Date.now())) {
        // Paid after the hold expired and someone else took the slot: keep the payment, ask to reschedule.
        b.consultation = { ...b.consultation, status: 'reschedule-requested', note: 'Your hold expired before payment.' }
      } else writeSlot(tx, 'consultation', b.consultation, bookingId, 'booked')
    }
    const t = logic.markPaid(b, paymentRef, APP_URL.value(), Date.now())
    tx.set(ref, t.booking)
    return t
  })
  if (t) await dispatch(t.booking, t.notify)
}

// ---------- customer callables ----------

export const createBooking = onCall(async (req) =>
  guard(async () => {
    const auth = requireUser(req)
    const { product, slot, name, phone } = req.data as { product: ProductId; slot?: Slot; name: string; phone: string }
    if (slot && !isValidSlot('consultation', slot.date, slot.time)) throw new HttpsError('invalid-argument', 'That slot is not available')
    const ref = bookings.doc()
    const booking = logic.createBooking({
      id: ref.id,
      uid: auth.uid,
      customer: { name: String(name || auth.token.name || '').slice(0, 80), email: auth.token.email ?? '', phone: String(phone ?? '') },
      product,
      slot: slot ? { date: slot.date, time: slot.time } : undefined,
      hasPaidConsultation: await hasPaidConsultation(auth.uid),
      now: Date.now(),
    })
    await db.runTransaction(async (tx) => {
      if (booking.consultation) {
        await assertSlotFree(tx, slotRef('consultation', booking.consultation), booking.id)
        writeSlot(tx, 'consultation', booking.consultation, booking.id, 'held', booking.holdUntil)
      }
      tx.set(ref, booking)
    })
    return { bookingId: booking.id }
  }),
)

export const createPaymentOrder = onCall({ secrets: [RAZORPAY_KEY_SECRET] }, async (req) =>
  guard(async () => {
    const auth = requireUser(req)
    const { bookingId } = req.data as { bookingId: string }
    const b = (await bookings.doc(bookingId).get()).data() as Booking | undefined
    if (!b || b.uid !== auth.uid) throw new HttpsError('not-found', 'Booking not found')
    if (b.paymentStatus === 'paid') throw new HttpsError('failed-precondition', 'This booking is already paid')
    const order = await razorpay().orders.create({
      amount: b.amount * 100, // paise — amount was computed server-side in createBooking
      currency: 'INR',
      receipt: b.id,
      notes: { bookingId: b.id, product: b.product },
    })
    await bookings.doc(b.id).update({ razorpayOrderId: order.id })
    return { orderId: order.id, amount: order.amount, currency: order.currency, keyId: RAZORPAY_KEY_ID.value(), customer: b.customer }
  }),
)

export const verifyPayment = onCall({ secrets: [RAZORPAY_KEY_SECRET, ...NOTIFY_SECRETS] }, async (req) =>
  guard(async () => {
    const auth = requireUser(req)
    const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.data as Record<string, string>
    const b = (await bookings.doc(bookingId).get()).data() as Booking | undefined
    if (!b || b.uid !== auth.uid) throw new HttpsError('not-found', 'Booking not found')
    const expected = hmac(RAZORPAY_KEY_SECRET.value(), `${razorpay_order_id}|${razorpay_payment_id}`)
    if (b.razorpayOrderId !== razorpay_order_id || !safeEqual(expected, String(razorpay_signature)))
      throw new HttpsError('permission-denied', 'Payment could not be verified')
    await finalizePayment(bookingId, razorpay_payment_id)
    return { ok: true }
  }),
)

/** Razorpay webhook (event: payment.captured) — a safety net if the browser closes before verifyPayment runs. */
export const razorpayWebhook = onRequest({ secrets: [RAZORPAY_WEBHOOK_SECRET, ...NOTIFY_SECRETS] }, async (req, res) => {
  const signature = String(req.headers['x-razorpay-signature'] ?? '')
  if (!safeEqual(hmac(RAZORPAY_WEBHOOK_SECRET.value(), req.rawBody.toString()), signature)) {
    res.status(400).send('bad signature')
    return
  }
  const payment = req.body?.payload?.payment?.entity
  if (req.body?.event === 'payment.captured' && payment?.notes?.bookingId) {
    const b = (await bookings.doc(payment.notes.bookingId).get()).data() as Booking | undefined
    if (b && b.razorpayOrderId === payment.order_id && b.amount * 100 === payment.amount)
      await finalizePayment(b.id, payment.id)
  }
  res.send('ok')
})

export const rescheduleConsultation = onCall({ secrets: NOTIFY_SECRETS }, async (req) =>
  guard(async () => {
    const auth = requireUser(req)
    const { bookingId, date, time } = req.data as { bookingId: string } & Slot
    if (!isValidSlot('consultation', date, time)) throw new HttpsError('invalid-argument', 'That slot is not available')
    const t = await db.runTransaction(async (tx) => {
      const b = await getOwnBooking(tx, bookingId, auth.uid)
      const ref = slotRef('consultation', { date, time })
      await assertSlotFree(tx, ref, b.id)
      const t = logic.rescheduleConsultation(b, { date, time }, APP_URL.value(), Date.now())
      writeSlot(tx, 'consultation', { date, time }, b.id, 'booked')
      tx.set(bookings.doc(b.id), t.booking)
      return t
    })
    await dispatch(t.booking, t.notify)
    return { ok: true }
  }),
)

export const bookDelivery = onCall({ secrets: NOTIFY_SECRETS }, async (req) =>
  guard(async () => {
    const auth = requireUser(req)
    const { bookingId, date, time, address } = req.data as { bookingId: string; address: string } & Slot
    if (!isValidSlot('delivery', date, time)) throw new HttpsError('invalid-argument', 'That slot is not available')
    const t = await db.runTransaction(async (tx) => {
      const b = await getOwnBooking(tx, bookingId, auth.uid)
      await assertSlotFree(tx, slotRef('delivery', { date, time }), b.id)
      const t = logic.bookDelivery(b, { date, time }, String(address ?? '').slice(0, 400), APP_URL.value(), Date.now())
      writeSlot(tx, 'delivery', { date, time }, b.id, 'booked')
      tx.set(bookings.doc(b.id), t.booking)
      return t
    })
    await dispatch(t.booking, t.notify)
    return { ok: true }
  }),
)

// ---------- admin ----------

export const adminAction = onCall({ secrets: NOTIFY_SECRETS }, async (req) =>
  guard(async () => {
    await requireAdmin(req)
    const { bookingId, action } = req.data as { bookingId: string; action: AdminAction }
    const t = await db.runTransaction(async (tx) => {
      const ref = bookings.doc(bookingId)
      const b = (await tx.get(ref)).data() as Booking | undefined
      if (!b) throw new HttpsError('not-found', 'Booking not found')
      const t = logic.applyAdminAction(b, action, APP_URL.value(), Date.now())
      // Asking the customer to pick another time frees their original slot.
      if (action.type === 'request-reschedule' && b.consultation) tx.delete(slotRef('consultation', b.consultation))
      tx.set(ref, t.booking)
      return t
    })
    await dispatch(t.booking, t.notify)
    return { ok: true }
  }),
)

// ---------- WhatsApp reminders ----------

/** Every 30 minutes: remind customers of confirmed consultations and deliveries within the next ~24h. */
export const sendReminders = onSchedule(
  { schedule: 'every 30 minutes', timeZone: 'Asia/Kolkata', secrets: NOTIFY_SECRETS },
  async () => {
    const now = Date.now()
    const { date: today } = nowIST(new Date(now))
    const { date: tomorrow } = nowIST(new Date(now + 86_400_000))
    const dueWithin24h = (s: Slot) => {
      const at = Date.parse(`${s.date}T${s.time}:00+05:30`)
      return at > now && at - now <= 24 * 3_600_000
    }

    const [consults, deliveries] = await Promise.all([
      bookings.where('consultation.status', '==', 'confirmed').where('consultation.date', 'in', [today, tomorrow]).get(),
      bookings.where('stage', '==', 'delivery-scheduled').where('delivery.date', 'in', [today, tomorrow]).get(),
    ])

    const jobs: Promise<unknown>[] = []
    for (const d of consults.docs) {
      const b = d.data() as Booking
      if (b.reminders?.consultation || !dueWithin24h(b.consultation!)) continue
      jobs.push(
        d.ref.update({ 'reminders.consultation': true }).then(() =>
          dispatch(b, [{ to: 'customer', channels: ['whatsapp'], message: messages.reminder(b, 'consultation', APP_URL.value()) }]),
        ),
      )
    }
    for (const d of deliveries.docs) {
      const b = d.data() as Booking
      if (b.reminders?.delivery || !dueWithin24h({ date: b.delivery!.date!, time: b.delivery!.time! })) continue
      jobs.push(
        d.ref.update({ 'reminders.delivery': true }).then(() =>
          dispatch(b, [{ to: 'customer', channels: ['whatsapp'], message: messages.reminder(b, 'delivery', APP_URL.value()) }]),
        ),
      )
    }
    await Promise.all(jobs)
    logger.info(`Sent ${jobs.length} reminders`)
  },
)
