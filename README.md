# Aaina — Cancer Hair Care & Wig Consultations

Booking platform for consultations, custom wigs made from the customer's own hair, and ready-made natural hair wigs.

**Stack:** React + Vite + TypeScript · Firebase (Google Auth, Firestore, Cloud Functions, Hosting) · Razorpay · SMTP email · WhatsApp Cloud API

## Run it locally (demo mode)

```bash
npm install
npm run dev
```

With no Firebase keys in `.env`, the app runs in **demo mode**. Everything is stored in the browser's localStorage, Google sign-in shows a demo account picker, payment is simulated, and emails and WhatsApp messages go to **Admin → Notification log** instead of being sent. Sign in as "Aaina Admin" in a second tab to try the admin console. The two tabs stay in sync.

## Pages

| Route | What it does |
|---|---|
| `/` | Landing page with two main paths: **Booking** and **Resources** |
| `/login` | Google sign-in |
| `/book` | The 4 options: Consultation ₹499 · **Book Complete Wig Package** ₹14,999 · **Already consulted? Book your wig now** ₹14,500 · Natural Hair Wig ₹14,999 (₹14,500 if the customer has a paid consultation) |
| `/book/:product` | Consultation slot picker (30-minute slots, 11:30 AM–7 PM, Mon–Fri) and contact details |
| `/checkout/:id` | Payment (Razorpay). The slot is held for 15 minutes |
| `/orders`, `/orders/:id` | Order tracking timeline, consultation status, reschedule, and **delivery slot booking** (15-minute slots, 11 AM–7 PM) once the admin enables it |
| `/resources` | Wig do's and don'ts, how-to videos, FAQ |
| `/admin` | New-booking alerts (sound, tab badge, desktop notification), a 30-minute confirmation timer, confirm or reschedule, order status updates (these send WhatsApp messages), enable delivery, schedule, and the notification log |

## Notification flow

| Event | Customer | Admin |
|---|---|---|
| Booking paid | Email + WhatsApp "received" | Email "new booking, confirm within 30 min" + live alert in the console |
| Admin confirms the slot | **Email + WhatsApp "slot confirmed"** | — |
| Admin asks to reschedule | Email + WhatsApp with a link to pick a new slot | — |
| Admin updates the order status | WhatsApp update | — |
| Admin enables delivery (wig ready) | **Email + WhatsApp with a delivery booking link** | — |
| Customer books delivery | Email + WhatsApp | Email |
| 24 hours before a consultation or delivery | WhatsApp reminder (scheduled function) | — |

## Going live

1. **Firebase project.** Create one, enable **Authentication → Google**, **Firestore**, and the **Blaze** plan (Functions needs it). Add a web app and copy its config into `.env` (see `.env.example`).
2. **Admins.** In Firestore, create the document `admins/<admin-email>` (it can be empty). Also list the same emails in `VITE_ADMIN_EMAILS`.
3. **Razorpay.** Get API keys. Add a webhook pointing to `https://asia-south1-<project>.cloudfunctions.net/razorpayWebhook` for the event `payment.captured`.
4. **WhatsApp Cloud API** (Meta Business). Create a *utility* template named `aaina_update` with the body `{{1}}`, or set your own with `WHATSAPP_TEMPLATE`. Get the phone number ID and a permanent access token.
5. **Email.** Use any SMTP account. For Gmail or Workspace, use an app password: `smtps://you@domain.com:APP_PASSWORD@smtp.gmail.com:465`.
6. **Deploy:**

```bash
npm i -g firebase-tools && firebase login && firebase use <project-id>
cd functions && npm install && cd ..
firebase functions:secrets:set RAZORPAY_KEY_SECRET
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
firebase functions:secrets:set SMTP_URL
firebase functions:secrets:set WHATSAPP_TOKEN
# Non-secret params (RAZORPAY_KEY_ID, WHATSAPP_PHONE_NUMBER_ID, ADMIN_NOTIFY_EMAIL, APP_URL, MAIL_FROM)
# are prompted for on first deploy and saved to functions/.env.<project-id>
npm run build && firebase deploy
```

## Where things live

- `src/shared/`: pricing, slot rules, order stages, message copy and state transitions. **Both** the web app and the Cloud Functions use these files. `functions` copies them in on build (`npm run sync-shared`).
- `src/content/site.ts`: editable copy (do's and don'ts, videos, testimonials, team, FAQ). Add the YouTube IDs for the videos there.
- `src/lib/backend/`: `demo.ts` (localStorage) and `firebase.ts` (production) implement the same interface.
- `functions/src/`: secure server logic. Prices are always calculated on the server, payments are verified by Razorpay signature, and slots are claimed in transactions.

## Before launch

- Replace the **placeholder testimonials and team** in `src/content/site.ts`. Use real testimonials only with the person's consent.
- Add the **video IDs** and the real **support WhatsApp number and email** (`.env`).
- Photos in `public/images/` come from Unsplash (free licence). Swap in your own when you have them.
