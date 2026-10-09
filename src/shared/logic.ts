// Booking state transitions. Pure functions: callers handle persistence, slots and sending.
import { PRODUCTS, STAGES, hasDelivery, priceFor, type ProductId } from './catalog'
import { messages, type Message } from './messages'
import { HOLD_MINUTES, type AdminAction, type Booking, type Slot } from './types'

export interface Notification {
  to: 'customer' | 'admin'
  channels: ('email' | 'whatsapp')[]
  message: Message
}

export interface Transition {
  booking: Booking
  notify: Notification[]
}

export class BookingError extends Error {}

const BOTH: Notification['channels'] = ['email', 'whatsapp']

export function createBooking(p: {
  id: string
  uid: string
  customer: Booking['customer']
  product: ProductId
  slot?: Slot
  hasPaidConsultation: boolean
  now: number
}): Booking {
  const product = PRODUCTS[p.product]
  if (!product) throw new BookingError('Unknown product')
  if (product.needsConsultationSlot && !p.slot) throw new BookingError('Please choose a consultation slot')
  if (p.product === 'wig-only' && !p.hasPaidConsultation)
    throw new BookingError('This option is for customers who have already booked a consultation with us')
  if (!/^\+?\d[\d\s-]{8,15}$/.test(p.customer.phone.trim())) throw new BookingError('Please enter a valid WhatsApp number')

  return {
    id: p.id,
    uid: p.uid,
    customer: { ...p.customer, phone: p.customer.phone.trim() },
    product: p.product,
    amount: priceFor(p.product, p.hasPaidConsultation),
    paymentStatus: 'pending',
    ...(product.needsConsultationSlot && p.slot
      ? { consultation: { ...p.slot, status: 'awaiting-confirmation' as const } }
      : {}),
    ...(hasDelivery(p.product) ? { delivery: { enabled: false } } : {}),
    stage: 'pending-payment',
    timeline: [],
    createdAt: p.now,
    holdUntil: p.now + HOLD_MINUTES * 60_000,
  }
}

export function markPaid(b: Booking, paymentRef: string, appUrl: string, now: number): Transition {
  if (b.paymentStatus === 'paid') return { booking: b, notify: [] }
  const timeline = [...b.timeline, { stage: 'paid', at: now }]
  let stage = 'paid'
  if (b.consultation) {
    stage = 'awaiting-confirmation'
    timeline.push({ stage, at: now })
  }
  const booking: Booking = { ...b, paymentStatus: 'paid', paymentRef, paidAt: now, stage, timeline, holdUntil: undefined }
  return {
    booking,
    notify: [
      { to: 'admin', channels: ['email'], message: messages.adminNewBooking(booking, appUrl) },
      { to: 'customer', channels: BOTH, message: messages.bookingReceived(booking, appUrl) },
    ],
  }
}

export function applyAdminAction(b: Booking, action: AdminAction, appUrl: string, now: number): Transition {
  if (b.paymentStatus !== 'paid') throw new BookingError('Booking is not paid yet')
  switch (action.type) {
    case 'confirm-consultation': {
      if (!b.consultation) throw new BookingError('No consultation on this booking')
      const booking: Booking = {
        ...b,
        consultation: { ...b.consultation, status: 'confirmed', confirmedAt: now, note: undefined },
        stage: 'consultation-confirmed',
        timeline: [...b.timeline, { stage: 'consultation-confirmed', at: now }],
      }
      return { booking, notify: [{ to: 'customer', channels: BOTH, message: messages.consultationConfirmed(booking, appUrl) }] }
    }
    case 'request-reschedule': {
      if (!b.consultation) throw new BookingError('No consultation on this booking')
      const booking: Booking = {
        ...b,
        consultation: { ...b.consultation, status: 'reschedule-requested', note: action.note },
        stage: 'awaiting-confirmation',
        timeline: [...b.timeline, { stage: 'awaiting-confirmation', note: 'New slot requested: ' + (action.note || 'please pick another time'), at: now }],
      }
      return {
        booking,
        notify: [{ to: 'customer', channels: BOTH, message: messages.rescheduleRequested(booking, appUrl, action.note) }],
      }
    }
    case 'enable-delivery': {
      if (!hasDelivery(b.product)) throw new BookingError('This booking has no delivery')
      const booking: Booking = {
        ...b,
        delivery: { ...b.delivery, enabled: true },
        stage: 'wig-ready',
        timeline: [...b.timeline, { stage: 'wig-ready', at: now }],
      }
      return { booking, notify: [{ to: 'customer', channels: BOTH, message: messages.deliveryEnabled(booking, appUrl) }] }
    }
    case 'set-stage': {
      if (!STAGES[b.product].some((s) => s.id === action.stage)) throw new BookingError('Unknown stage')
      if (action.stage === 'wig-ready') return applyAdminAction(b, { type: 'enable-delivery' }, appUrl, now)
      const booking: Booking = {
        ...b,
        stage: action.stage,
        timeline: [...b.timeline, { stage: action.stage, note: action.note || undefined, at: now }],
      }
      return {
        booking,
        notify: [{ to: 'customer', channels: ['whatsapp'], message: messages.stageUpdated(booking, appUrl, action.note) }],
      }
    }
  }
}

export function rescheduleConsultation(b: Booking, slot: Slot, appUrl: string, now: number): Transition {
  if (b.consultation?.status !== 'reschedule-requested') throw new BookingError('This consultation cannot be rescheduled')
  const booking: Booking = {
    ...b,
    consultation: { ...slot, status: 'awaiting-confirmation' },
    timeline: [...b.timeline, { stage: 'awaiting-confirmation', note: 'New slot chosen', at: now }],
  }
  return { booking, notify: [{ to: 'admin', channels: ['email'], message: messages.adminNewBooking(booking, appUrl) }] }
}

export function bookDelivery(b: Booking, slot: Slot, address: string, appUrl: string, now: number): Transition {
  if (!b.delivery?.enabled) throw new BookingError('Delivery is not open for this order yet')
  if (b.delivery.date) throw new BookingError('Delivery is already scheduled')
  if (address.trim().length < 10) throw new BookingError('Please enter your full delivery address')
  const booking: Booking = {
    ...b,
    delivery: { enabled: true, ...slot, address: address.trim() },
    stage: 'delivery-scheduled',
    timeline: [...b.timeline, { stage: 'delivery-scheduled', at: now }],
  }
  return {
    booking,
    notify: [
      { to: 'customer', channels: BOTH, message: messages.deliveryBooked(booking, appUrl) },
      { to: 'admin', channels: ['email'], message: messages.adminDeliveryBooked(booking, appUrl) },
    ],
  }
}
