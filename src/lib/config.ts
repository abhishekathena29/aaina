const env = import.meta.env

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
}

/** Without Firebase keys the app runs on the local demo backend. */
export const IS_DEMO = !firebaseConfig.apiKey

export const FUNCTIONS_REGION = (env.VITE_FUNCTIONS_REGION as string | undefined) || 'asia-south1'

/** Used only to show/hide the admin console in the UI; real enforcement lives in Firestore rules + Functions. */
export const ADMIN_EMAILS = ((env.VITE_ADMIN_EMAILS as string | undefined) || (IS_DEMO ? 'admin@aaina.demo' : ''))
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export const APP_URL = (env.VITE_APP_URL as string | undefined) || window.location.origin

export const SUPPORT_WHATSAPP = (env.VITE_SUPPORT_WHATSAPP as string | undefined) || '+91 90000 00000'
export const SUPPORT_EMAIL = (env.VITE_SUPPORT_EMAIL as string | undefined) || 'care@aaina.in'
