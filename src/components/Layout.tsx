import { LogOut, Menu, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, useBackend } from '../lib/app-context'
import { IS_DEMO, SUPPORT_EMAIL, SUPPORT_WHATSAPP } from '../lib/config'

export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <ellipse cx="16" cy="13" rx="9" ry="11" fill="none" stroke="var(--gold)" strokeWidth="2.4" />
      <path d="M11.5 9.5c1-2 2.6-3 4.5-3.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity=".55" />
      <path d="M16 24v5M12.5 29.5h7" stroke="var(--gold)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Aaina home">
      <LogoMark />
      <span>Aaina</span>
    </Link>
  )
}

const NAV = [
  { to: '/book', label: 'Book' },
  { to: '/resources', label: 'Resources' },
  { to: '/orders', label: 'My Orders' },
]

export function Navbar({ overlay = false }: { overlay?: boolean }) {
  const { user, isAdmin } = useAuth()
  const backend = useBackend()
  const navigate = useNavigate()
  const location = useLocation()
  // The mobile menu is open only on the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === location.pathname
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const cls = ['nav', overlay && !scrolled && !open ? 'nav--overlay' : 'nav--solid', open ? 'nav--open' : '']
  return (
    <header className={cls.join(' ')}>
      <div className="nav__inner container">
        <Logo />
        <nav className="nav__links">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to}>
              {n.label}
            </NavLink>
          ))}
          {isAdmin && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="nav__actions">
          {user ? (
            <>
              <span className="nav__user" title={user.email}>
                {user.photoURL ? <img src={user.photoURL} alt="" /> : <span>{user.name[0]}</span>}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => backend.signOut().then(() => navigate('/'))}
                aria-label="Sign out"
              >
                <LogOut size={15} /> <span className="hide-sm">Sign out</span>
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-ghost btn-sm">
              Sign in
            </Link>
          )}
          <Link to="/book" className="btn btn-light btn-sm hide-sm">
            Book Now
          </Link>
          <button className="nav__burger" onClick={() => setOpenOn(open ? null : location.pathname)} aria-label="Menu">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="nav__mobile container">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to}>
              {n.label}
            </NavLink>
          ))}
          {isAdmin && <NavLink to="/admin">Admin console</NavLink>}
          <Link to="/book" className="btn btn-gold">
            Book Now
          </Link>
        </nav>
      )}
    </header>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          <div className="footer__brand">
            <Logo />
            <p>Dignified, personal hair care and wig services for people going through cancer treatment.</p>
          </div>
          <div className="footer__cols">
            <div>
              <h4>Services</h4>
              <Link to="/book/consultation">Consultation</Link>
              <Link to="/book/complete-package">Complete Wig Package</Link>
              <Link to="/book/wig-only">Wig Package</Link>
              <Link to="/book/natural-wig">Natural Hair Wigs</Link>
            </div>
            <div>
              <h4>Support</h4>
              <Link to="/resources">Wig care guide</Link>
              <Link to="/resources#videos">How-to videos</Link>
              <Link to="/orders">Track your order</Link>
            </div>
            <div>
              <h4>Contact</h4>
              <a href={`https://wa.me/${SUPPORT_WHATSAPP.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                WhatsApp {SUPPORT_WHATSAPP}
              </a>
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              <span>Mon–Fri, 11 AM – 7 PM</span>
            </div>
          </div>
        </div>
        <div className="footer__bottom">
          <span>© {new Date().getFullYear()} Aaina. All rights reserved.</span>
          <span>Aaina offers hair and wig services and does not provide medical advice.</span>
        </div>
      </div>
    </footer>
  )
}

export function Page({ children, overlayNav = false }: { children: ReactNode; overlayNav?: boolean }) {
  return (
    <>
      {IS_DEMO && <DemoBanner />}
      <Navbar overlay={overlayNav} />
      <main className={overlayNav ? '' : 'page'}>{children}</main>
      <Footer />
    </>
  )
}

function DemoBanner() {
  return (
    <div className="demo-banner">
      Demo mode — data is stored in this browser and no real payments, emails or WhatsApp messages are sent.{' '}
      <Link to="/admin">Open admin console</Link>
    </div>
  )
}

export function Eyebrow({ children, light }: { children: ReactNode; light?: boolean }) {
  return <p className={'eyebrow' + (light ? ' eyebrow--light' : '')}>{children}</p>
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to={'/login?next=' + encodeURIComponent(location.pathname + location.hash)} replace />
  return <>{children}</>
}

export function PageLoader() {
  return (
    <div className="loader-wrap">
      <span className="spinner" />
    </div>
  )
}
