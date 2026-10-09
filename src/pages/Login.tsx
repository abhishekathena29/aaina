import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LogoMark } from '../components/Layout'
import { useAuth, useBackend } from '../lib/app-context'
import { ADMIN_EMAILS, IS_DEMO } from '../lib/config'

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

const DEMO_ACCOUNTS = [
  { name: 'Priya Sharma', email: 'priya@aaina.demo', note: 'Patient' },
  { name: 'Aaina Admin', email: ADMIN_EMAILS[0] ?? 'admin@aaina.demo', note: 'Admin console' },
]

export default function Login() {
  const backend = useBackend()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/book'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [chooser, setChooser] = useState(false)

  useEffect(() => {
    if (user) navigate(next, { replace: true })
  }, [user, next, navigate])

  async function signIn(profile?: { name: string; email: string }) {
    setBusy(true)
    setError('')
    try {
      await backend.signInWithGoogle(profile)
    } catch (e) {
      const msg = (e as Error).message
      if (!/popup-closed|cancelled/i.test(msg)) setError('Sign-in failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login__visual" style={{ backgroundImage: 'url(/images/login.jpg)' }}>
        <div className="login__shade" />
        <Link to="/" className="login__back">
          <ArrowLeft size={16} /> Back to home
        </Link>
        <blockquote>
          “Every journey deserves to be met with gentleness — and every reflection, with kindness.”
        </blockquote>
      </div>

      <div className="login__panel">
        <div className="login__card">
          <div className="login__brand">
            <LogoMark size={34} />
          </div>
          <h1 className="h2">Welcome to Aaina</h1>
          <p className="muted">Sign in to book consultations, purchase wigs and follow your order every step of the way.</p>

          {!chooser ? (
            <button className="btn btn-google" disabled={busy} onClick={() => (IS_DEMO ? setChooser(true) : signIn())}>
              {busy ? <span className="spinner spinner--sm" /> : <GoogleG />}
              Continue with Google
            </button>
          ) : (
            <div className="chooser">
              <p className="chooser__title">
                <GoogleG /> Choose a demo account
              </p>
              {DEMO_ACCOUNTS.map((a) => (
                <button key={a.email} className="chooser__item" disabled={busy} onClick={() => signIn(a)}>
                  <span className="chooser__avatar">{a.name[0]}</span>
                  <span>
                    <strong>{a.name}</strong>
                    <small>
                      {a.email} · {a.note}
                    </small>
                  </span>
                </button>
              ))}
              <button className="link-underline small" onClick={() => setChooser(false)}>
                Cancel
              </button>
            </div>
          )}
          {error && <p className="form-error">{error}</p>}

          <p className="login__fine">
            <ShieldCheck size={14} /> We only use your name and email to manage your bookings. Your information stays
            private.
          </p>
        </div>
      </div>
    </div>
  )
}
