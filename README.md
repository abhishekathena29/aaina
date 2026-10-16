# Aaina — Cancer Hair Care & Wig Consultations

Booking platform for consultations, custom wigs made from the customer's own hair, and ready-made natural hair wigs.

**Stack:** React + Vite + TypeScript · Firebase (Google Auth, Firestore, Hosting, Trigger Email extension) · Razorpay Checkout · WhatsApp via wa.me

There is **no server code to host**. The web app writes to Firestore directly, and `firestore.rules` validates every write.

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
| `/admin` | New-booking alerts (sound, tab badge, desktop notification), a 30-minute confirmation timer, payment verification, confirm or reschedule, order status updates, enable delivery, **WhatsApp to send** queue (one-tap sending, 24-hour reminders), schedule, and the notification log |

## Notification flow

Emails are sent automatically by the Firebase **Trigger Email** extension. WhatsApp messages can't be sent from a browser without exposing an API token, so they're queued in **Admin → WhatsApp to send**: one tap opens WhatsApp with the message filled in.

| Event | Customer | Admin |
|---|---|---|
| Booking paid | Email + WhatsApp "received" | Email "new booking, confirm within 30 min" + live alert in the console |
| Admin confirms the slot | **Email + WhatsApp "slot confirmed"** | — |
| Admin asks to reschedule | Email + WhatsApp with a link to pick a new slot | — |
| Admin updates the order status | WhatsApp update | — |
| Admin enables delivery (wig ready) | **Email + WhatsApp with a delivery booking link** | — |
| Customer books delivery | Email + WhatsApp | Email |
| 24 hours before a consultation or delivery | WhatsApp reminder (appears in the admin's WhatsApp queue) | — |

## Payments without a server

Razorpay order creation and signature checks need the key secret, which can't live in the browser. So the app opens Razorpay Checkout **without an order** and saves the returned payment ID (`pay_…`) on the booking. The Firestore rules make sure prices are correct and that a customer can only change their own booking from pending to paid. The rules **can't** prove the payment really happened, though, so:

- Every paid booking shows **Payment not verified** in the admin console, with a link to that payment in the Razorpay dashboard.
- Check the amount, check that the booking ID matches the payment's notes, and **capture** the payment if it shows as *Authorized*. Then click **Mark payment verified**.
- Do this before confirming a slot or starting work on a wig.

Razorpay usually only auto-captures payments made through Orders. Check your account's capture settings. Uncaptured payments are refunded automatically after a few days.

## Going live

1. **Firebase project.** Create one and enable **Authentication → Google** and **Firestore**. Add a web app and copy its config into `.env` (see `.env.example`).
2. **Admins.** In Firestore, create the document `admins/<admin-email>` (it can be empty) for each admin. List the same emails in `VITE_ADMIN_EMAILS`. Set `VITE_ADMIN_NOTIFY_EMAIL` to an email that has an `admins` document, otherwise the rules reject "new booking" emails.
3. **Razorpay.** Put your **Key ID** in `VITE_RAZORPAY_KEY_ID`. The key secret isn't used anywhere.
4. **Email.** Install the **Trigger Email from Firestore** extension (Firebase console → Extensions). Set the collection to `mail` and give it an SMTP URI, e.g. `smtps://you@domain.com:APP_PASSWORD@smtp.gmail.com:465`, plus a default FROM address. Extensions need the Blaze plan, but you don't write or deploy any function code. Skip this step and emails stay queued in `mail` (everything else still works).
5. **WhatsApp.** No setup. Admins send queued messages from **Admin → WhatsApp to send** using the business WhatsApp on their phone or WhatsApp Web.
6. **Deploy:**

```bash
npm i -g firebase-tools && firebase login && firebase use <project-id>
npm run build && firebase deploy   # hosting + firestore rules/indexes
```

## Where things live

- `src/shared/`: pricing, slot rules, order stages, message copy and state transitions, used by both backends. If you change prices, update them in `firestore.rules` too.
- `src/content/site.ts`: editable copy (do's and don'ts, videos, testimonials, team, FAQ). Add the YouTube IDs for the videos there.
- `src/lib/backend/`: `demo.ts` (localStorage) and `firebase.ts` (production) implement the same interface.
- `firestore.rules`: the security layer. It checks prices and discount credits, slot claims (only after a hold expires), which fields each step may change, and notification recipients.

## Before launch

- Replace the **placeholder testimonials and team** in `src/content/site.ts`. Use real testimonials only with the person's consent.
- Add the **video IDs** and the real **support WhatsApp number and email** (`.env`).
- Photos in `public/images/` come from Unsplash (free licence). Swap in your own when you have them.
