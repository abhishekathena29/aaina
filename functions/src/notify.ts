// Email (SMTP via nodemailer) + WhatsApp (Meta WhatsApp Cloud API). Every send is logged to `outbox`.
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { defineSecret, defineString } from 'firebase-functions/params'
import nodemailer from 'nodemailer'
import type { Notification } from './shared/logic'
import type { Booking } from './shared/types'

export const SMTP_URL = defineSecret('SMTP_URL') // e.g. smtps://user:app-password@smtp.gmail.com:465
export const MAIL_FROM = defineString('MAIL_FROM', { default: 'Aaina <care@aaina.in>' })
export const ADMIN_NOTIFY_EMAIL = defineString('ADMIN_NOTIFY_EMAIL')
export const WHATSAPP_TOKEN = defineSecret('WHATSAPP_TOKEN')
export const WHATSAPP_PHONE_NUMBER_ID = defineString('WHATSAPP_PHONE_NUMBER_ID')
// An approved "utility" template with a single body variable {{1}}, e.g. "{{1}} — Team Aaina".
export const WHATSAPP_TEMPLATE = defineString('WHATSAPP_TEMPLATE', { default: 'aaina_update' })
export const WHATSAPP_TEMPLATE_LANG = defineString('WHATSAPP_TEMPLATE_LANG', { default: 'en' })
export const APP_URL = defineString('APP_URL')

export const NOTIFY_SECRETS = [SMTP_URL, WHATSAPP_TOKEN]

/** Normalise an Indian/international number to WhatsApp's digits-only E.164 format. */
function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10 ? '91' + digits : digits.replace(/^0+/, '')
}

async function sendEmail(to: string, subject: string, body: string) {
  const transport = nodemailer.createTransport(SMTP_URL.value())
  await transport.sendMail({ from: MAIL_FROM.value(), to, subject, text: body })
}

async function sendWhatsApp(to: string, body: string) {
  // Template variables may not contain newlines or tabs.
  const text = body.replace(/\s*\n\s*/g, ' · ').slice(0, 1000)
  const res = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID.value()}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN.value()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: waNumber(to),
      type: 'template',
      template: {
        name: WHATSAPP_TEMPLATE.value(),
        language: { code: WHATSAPP_TEMPLATE_LANG.value() },
        components: [{ type: 'body', parameters: [{ type: 'text', text }] }],
      },
    }),
  })
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${await res.text()}`)
}

/** Sends notifications; failures are logged but never fail the user's action. */
export async function dispatch(booking: Booking, notifications: Notification[]) {
  const db = getFirestore()
  await Promise.all(
    notifications.flatMap((n) =>
      n.channels.map(async (channel) => {
        const to =
          n.to === 'admin'
            ? ADMIN_NOTIFY_EMAIL.value()
            : channel === 'email'
              ? booking.customer.email
              : booking.customer.phone
        if (!to || (n.to === 'admin' && channel === 'whatsapp')) return
        let error: string | undefined
        try {
          if (channel === 'email') await sendEmail(to, n.message.subject, n.message.body)
          else await sendWhatsApp(to, n.message.body)
        } catch (e) {
          error = (e as Error).message
          logger.error('Notification failed', { channel, to, bookingId: booking.id, error })
        }
        await db.collection('outbox').add({
          channel,
          to,
          subject: n.message.subject,
          body: n.message.body,
          bookingId: booking.id,
          at: Date.now(),
          ...(error ? { error } : {}),
        })
      }),
    ),
  )
}
