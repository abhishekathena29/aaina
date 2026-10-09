// Notification copy shared by the demo backend and Cloud Functions.
import { PRODUCTS, formatDate, formatINR, formatTime, slotEnd, stageLabel } from './catalog'
import type { Booking } from './types'

export interface Message {
  subject: string
  body: string
}

const firstName = (b: Booking) => b.customer.name.split(' ')[0] || 'there'
const slotText = (kind: 'consultation' | 'delivery', date: string, time: string) =>
  `${formatDate(date)}, ${formatTime(time)} – ${formatTime(slotEnd(kind, time))} IST`

export const messages = {
  adminNewBooking(b: Booking, appUrl: string): Message {
    const c = b.consultation
    return {
      subject: `New ${PRODUCTS[b.product].name} booking — ${b.customer.name}`,
      body:
        `${b.customer.name} (${b.customer.email}, ${b.customer.phone}) paid ${formatINR(b.amount)} for ${PRODUCTS[b.product].name}.` +
        (c ? `\nRequested consultation: ${slotText('consultation', c.date, c.time)}.\nPlease confirm within 30 minutes.` : '') +
        `\n\nOpen admin console: ${appUrl}/admin`,
    }
  },

  bookingReceived(b: Booking, appUrl: string): Message {
    const c = b.consultation
    return {
      subject: `We've received your booking — Aaina`,
      body:
        `Hi ${firstName(b)}, thank you for choosing Aaina. We've received your payment of ${formatINR(b.amount)} for ${PRODUCTS[b.product].name}.` +
        (c ? ` Your requested slot (${slotText('consultation', c.date, c.time)}) will be confirmed within 30 minutes.` : '') +
        `\nTrack your order: ${appUrl}/orders/${b.id}`,
    }
  },

  consultationConfirmed(b: Booking, appUrl: string): Message {
    const c = b.consultation!
    return {
      subject: `Your consultation is confirmed — ${formatDate(c.date)}, ${formatTime(c.time)}`,
      body:
        `Hi ${firstName(b)}, your consultation slot is confirmed for ${slotText('consultation', c.date, c.time)}.` +
        `\nWe look forward to meeting you. If anything changes, simply reply to this message.` +
        `\nOrder details: ${appUrl}/orders/${b.id}`,
    }
  },

  rescheduleRequested(b: Booking, appUrl: string, note: string): Message {
    return {
      subject: `Please choose a new consultation slot — Aaina`,
      body:
        `Hi ${firstName(b)}, we're sorry — we couldn't hold your requested slot.` +
        (note ? ` ${note}` : '') +
        `\nPlease pick another time here: ${appUrl}/orders/${b.id}`,
    }
  },

  stageUpdated(b: Booking, appUrl: string, note?: string): Message {
    return {
      subject: `Order update: ${stageLabel(b.product, b.stage)}`,
      body:
        `Hi ${firstName(b)}, an update on your ${PRODUCTS[b.product].name}: ${stageLabel(b.product, b.stage)}.` +
        (note ? `\n${note}` : '') +
        `\nTrack it here: ${appUrl}/orders/${b.id}`,
    }
  },

  deliveryEnabled(b: Booking, appUrl: string): Message {
    return {
      subject: `Your wig is ready — book your delivery slot`,
      body:
        `Hi ${firstName(b)}, wonderful news — your wig is ready!` +
        `\nPlease book a personalised delivery slot (Mon–Fri, 11 AM – 7 PM): ${appUrl}/orders/${b.id}#delivery`,
    }
  },

  deliveryBooked(b: Booking, appUrl: string): Message {
    const d = b.delivery!
    return {
      subject: `Delivery scheduled — ${formatDate(d.date!)}, ${formatTime(d.time!)}`,
      body:
        `Hi ${firstName(b)}, your personalised delivery is booked for ${slotText('delivery', d.date!, d.time!)}.` +
        `\nAddress: ${d.address}\nDetails: ${appUrl}/orders/${b.id}`,
    }
  },

  reminder(b: Booking, kind: 'consultation' | 'delivery', appUrl: string): Message {
    const s = kind === 'consultation' ? b.consultation! : { date: b.delivery!.date!, time: b.delivery!.time! }
    return {
      subject: `Reminder: your ${kind} with Aaina`,
      body:
        `Hi ${firstName(b)}, a gentle reminder of your ${kind === 'consultation' ? 'consultation' : 'wig delivery'} on ${slotText(kind, s.date, s.time)}.` +
        `\nDetails: ${appUrl}/orders/${b.id}`,
    }
  },

  adminDeliveryBooked(b: Booking, appUrl: string): Message {
    const d = b.delivery!
    return {
      subject: `Delivery booked — ${b.customer.name}`,
      body: `${b.customer.name} booked delivery for ${slotText('delivery', d.date!, d.time!)} at ${d.address}.\n${appUrl}/admin`,
    }
  },
}
