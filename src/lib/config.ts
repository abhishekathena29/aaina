const env = import.meta.env

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
}

/** Without Firebase keys the app runs on the local demo backend. */
export const IS_DEMO = !firebaseConfig.apiKey

/** Razorpay key id (public). The key secret is never needed in this app. */
export const RAZORPAY_KEY_ID = (env.VITE_RAZORPAY_KEY_ID as string | undefined) || ''

/** Used only to show/hide the admin console in the UI; real enforcement lives in firestore.rules. */
export const ADMIN_EMAILS = ((env.VITE_ADMIN_EMAILS as string | undefined) || (IS_DEMO ? 'admin@aaina.demo' : ''))
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

/** Receives "new booking" emails. Must also exist as a document in the Firestore `admins` collection. */
export const ADMIN_NOTIFY_EMAIL = (env.VITE_ADMIN_NOTIFY_EMAIL as string | undefined) || ADMIN_EMAILS[0] || ''

export const APP_URL = (env.VITE_APP_URL as string | undefined) || window.location.origin

export const SUPPORT_WHATSAPP = (env.VITE_SUPPORT_WHATSAPP as string | undefined) || '+91 90000 00000'
export const SUPPORT_EMAIL = (env.VITE_SUPPORT_EMAIL as string | undefined) || 'care@aaina.in'
