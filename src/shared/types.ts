import type { ConsultationStatus, ProductId } from './catalog'

export interface Slot {
  date: string
  time: string
}

export interface TimelineEntry {
  stage: string
  note?: string
  at: number
}

export interface Booking {
  id: string
  uid: string
  customer: { name: string; email: string; phone: string }
  product: ProductId
  amount: number
  paymentStatus: 'pending' | 'paid'
  paymentRef?: string
  consultation?: Slot & { status: ConsultationStatus; confirmedAt?: number; note?: string }
  delivery?: { enabled: boolean; date?: string; time?: string; address?: string }
  stage: string
  timeline: TimelineEntry[]
  createdAt: number
  paidAt?: number
  /** Unpaid bookings hold their slot until this time (ms). */
  holdUntil?: number
  /** Admin has checked the payment in the Razorpay dashboard. */
  paymentVerified?: boolean
  /** The paid consultation booking that earns this booking its discount. */
  creditBookingId?: string
  /** WhatsApp reminders already sent. */
  reminders?: { consultation?: boolean; delivery?: boolean }
}

export interface OutboxMessage {
  id: string
  channel: 'email' | 'whatsapp'
  to: string
  subject?: string
  body: string
  bookingId: string
  at: number
  /** WhatsApp messages wait for an admin to send them via wa.me. */
  status?: 'pending' | 'sent'
}

export type AdminAction =
  | { type: 'confirm-consultation' }
  | { type: 'request-reschedule'; note: string }
  | { type: 'set-stage'; stage: string; note?: string }
  | { type: 'enable-delivery' }
  | { type: 'verify-payment' }

export const HOLD_MINUTES = 15
