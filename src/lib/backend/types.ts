import type { ProductId, SlotKind } from '../../shared/catalog'
import type { AdminAction, Booking, OutboxMessage, Slot } from '../../shared/types'

export interface AppUser {
  uid: string
  name: string
  email: string
  photoURL?: string
}

export type Unsubscribe = () => void

export interface Backend {
  mode: 'demo' | 'firebase'

  onAuthChange(cb: (user: AppUser | null) => void): Unsubscribe
  /** In demo mode an explicit profile can be passed (the login page shows an account chooser). */
  signInWithGoogle(demoProfile?: Omit<AppUser, 'uid'>): Promise<void>
  signOut(): Promise<void>

  /** Keys from `slotKey()` that are booked or held. */
  watchTakenSlots(kind: SlotKind, cb: (taken: Set<string>) => void): Unsubscribe

  hasPaidConsultation(): Promise<boolean>
  createBooking(input: { product: ProductId; slot?: Slot; name: string; phone: string }): Promise<string>
  /** Collects payment for a pending booking. Resolves once the booking is marked paid. */
  pay(bookingId: string): Promise<void>
  watchBooking(id: string, cb: (b: Booking | null) => void): Unsubscribe
  watchMyBookings(cb: (bookings: Booking[]) => void): Unsubscribe
  rescheduleConsultation(bookingId: string, slot: Slot): Promise<void>
  bookDelivery(bookingId: string, slot: Slot, address: string): Promise<void>

  // Admin
  watchAllBookings(cb: (bookings: Booking[]) => void): Unsubscribe
  adminAction(bookingId: string, action: AdminAction): Promise<void>
  watchOutbox(cb: (messages: OutboxMessage[]) => void): Unsubscribe
  /** Call after the admin has sent a queued WhatsApp message via wa.me. */
  markWhatsAppSent(messageId: string): Promise<void>
  markReminderSent(bookingId: string, kind: 'consultation' | 'delivery'): Promise<void>
}
