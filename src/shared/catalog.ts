// Pure domain logic shared by the web app and Cloud Functions.
// Keep this file dependency-free: `npm run sync-shared` copies it into functions/src/shared.

export type ProductId = 'consultation' | 'complete-package' | 'wig-only' | 'natural-wig'

export const CONSULTATION_PRICE = 499
export const WIG_PRICE = 14999

export interface Product {
  id: ProductId
  name: string
  cta: string
  tagline: string
  includes: string[]
  needsConsultationSlot: boolean
}

export const PRODUCTS: Record<ProductId, Product> = {
  consultation: {
    id: 'consultation',
    name: 'Consultation',
    cta: 'Book a Consultation',
    tagline: 'A private 30-minute session to talk through your hair journey and options.',
    includes: ['30-minute one-on-one session', 'Scalp & hair assessment', 'Personalised wig guidance'],
    needsConsultationSlot: true,
  },
  'complete-package': {
    id: 'complete-package',
    name: 'Complete Wig Package',
    cta: 'Book Complete Wig Package',
    tagline: 'Consultation, haircut, your own-hair wig and personalised delivery — all handled for you.',
    includes: ['Consultation', 'Haircut', 'Custom wig from your own hair', 'Personalised delivery'],
    needsConsultationSlot: true,
  },
  'wig-only': {
    id: 'wig-only',
    name: 'Wig Package',
    cta: 'Already consulted? Book your wig now',
    tagline: 'Already had your consultation with us? Go straight to your haircut and custom wig.',
    includes: ['Haircut', 'Custom wig from your own hair', 'Personalised delivery'],
    needsConsultationSlot: false,
  },
  'natural-wig': {
    id: 'natural-wig',
    name: 'Ready-made Natural Hair Wig',
    cta: 'Buy a Natural Hair Wig',
    tagline: 'Loved one of our natural hair samples? Take it home — no haircut needed.',
    includes: ['Ready-made natural human-hair wig', 'Fitting guidance', 'Personalised delivery'],
    needsConsultationSlot: false,
  },
}

/** Price in rupees. `hasPaidConsultation` = the user has a separately paid consultation booking. */
export function priceFor(product: ProductId, hasPaidConsultation: boolean): number {
  switch (product) {
    case 'consultation':
      return CONSULTATION_PRICE
    case 'complete-package':
      return WIG_PRICE
    case 'wig-only':
      return WIG_PRICE - CONSULTATION_PRICE
    case 'natural-wig':
      return hasPaidConsultation ? WIG_PRICE - CONSULTATION_PRICE : WIG_PRICE
  }
}

// ---------- Slots ----------
// All times are IST wall-clock. Dates are 'YYYY-MM-DD', times 'HH:mm'.

export type SlotKind = 'consultation' | 'delivery'

export const SLOT_RULES: Record<SlotKind, { start: string; end: string; minutes: number }> = {
  consultation: { start: '11:30', end: '19:00', minutes: 30 },
  delivery: { start: '11:00', end: '19:00', minutes: 15 },
}

export const BOOKING_WINDOW_DAYS = 21

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export function slotTimes(kind: SlotKind): string[] {
  const { start, end, minutes } = SLOT_RULES[kind]
  const out: string[] = []
  for (let m = toMin(start); m + minutes <= toMin(end); m += minutes) out.push(fromMin(m))
  return out
}

export function slotEnd(kind: SlotKind, time: string): string {
  return fromMin(toMin(time) + SLOT_RULES[kind].minutes)
}

export const slotKey = (kind: SlotKind, date: string, time: string) => `${kind}_${date}_${time}`

/** Current IST date/time, independent of the device/server timezone. */
export function nowIST(now = new Date()): { date: string; minutes: number } {
  const ist = new Date(now.getTime() + 330 * 60_000)
  return { date: ist.toISOString().slice(0, 10), minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes() }
}

/** Weekdays (Mon–Fri) from today (IST) for the booking window. */
export function bookableDates(now = new Date(), days = BOOKING_WINDOW_DAYS): string[] {
  const out: string[] = []
  const start = new Date(nowIST(now).date + 'T00:00:00Z')
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86_400_000)
    const dow = d.getUTCDay()
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10))
  }
  return out
}

/** Is this a valid, future slot under the rules? (Lead time: 1 hour.) */
export function isValidSlot(kind: SlotKind, date: string, time: string, now = new Date()): boolean {
  if (!bookableDates(now).includes(date)) return false
  if (!slotTimes(kind).includes(time)) return false
  const ist = nowIST(now)
  if (date === ist.date && toMin(time) < ist.minutes + 60) return false
  return true
}

// ---------- Orders ----------

export type ConsultationStatus = 'awaiting-confirmation' | 'confirmed' | 'reschedule-requested'

export interface Stage {
  id: string
  label: string
  description: string
}

const S = (id: string, label: string, description: string): Stage => ({ id, label, description })

const PAID = S('paid', 'Payment received', 'Your payment was successful.')
const AWAITING = S('awaiting-confirmation', 'Slot requested', 'We confirm consultation slots within 30 minutes.')
const CONFIRMED = S('consultation-confirmed', 'Consultation confirmed', 'Your consultation slot is confirmed.')
const CONSULTED = S('consultation-done', 'Consultation complete', 'Thank you for meeting us.')
const HAIRCUT = S('haircut-done', 'Haircut done', 'Your hair has been collected for your wig.')
const MAKING = S('wig-in-progress', 'Wig being crafted', 'Our artisans are making your wig.')
const PREPARING = S('wig-in-progress', 'Wig being prepared', 'We are preparing and styling your wig.')
const READY = S('wig-ready', 'Wig ready', 'Your wig is ready — pick a delivery slot.')
const SCHEDULED = S('delivery-scheduled', 'Delivery scheduled', 'Your personalised delivery is booked.')
const DELIVERED = S('delivered', 'Delivered', 'Wishing you confidence and comfort.')

export const STAGES: Record<ProductId, Stage[]> = {
  consultation: [PAID, AWAITING, CONFIRMED, CONSULTED],
  'complete-package': [PAID, AWAITING, CONFIRMED, CONSULTED, HAIRCUT, MAKING, READY, SCHEDULED, DELIVERED],
  'wig-only': [PAID, HAIRCUT, MAKING, READY, SCHEDULED, DELIVERED],
  'natural-wig': [PAID, PREPARING, READY, SCHEDULED, DELIVERED],
}

export function stageLabel(product: ProductId, stageId: string): string {
  return STAGES[product].find((s) => s.id === stageId)?.label ?? stageId
}

export const hasDelivery = (product: ProductId) => product !== 'consultation'

export const formatINR = (n: number) => '₹' + n.toLocaleString('en-IN')

export function formatDate(date: string): string {
  return new Date(date + 'T00:00:00Z').toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export function formatTime(time: string): string {
  const m = toMin(time)
  const h = Math.floor(m / 60)
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
