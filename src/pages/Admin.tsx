import {
  Bell,
  BellRing,
  CalendarClock,
  Check,
  ChevronDown,
  Clock,
  IndianRupee,
  Mail,
  MessageCircle,
  Search,
  Truck,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Navbar, PageLoader, RequireAuth } from '../components/Layout'
import { useAuth, useBackend } from '../lib/app-context'
import { IS_DEMO } from '../lib/config'
import {
  PRODUCTS,
  STAGES,
  formatDate,
  formatINR,
  formatTime,
  hasDelivery,
  nowIST,
  type ProductId,
} from '../shared/catalog'
import type { AdminAction, Booking, OutboxMessage } from '../shared/types'
import { StatusBadge } from './Orders'

const CONFIRM_WITHIN_MS = 30 * 60_000

export default function Admin() {
  return (
    <RequireAuth>
      <AdminGate />
    </RequireAuth>
  )
}

function AdminGate() {
  const { isAdmin, user } = useAuth()
  if (!isAdmin)
    return (
      <>
        <Navbar />
        <main className="page container">
          <div className="card empty">
            <h3>Admins only</h3>
            <p className="muted">
              {user?.email} doesn't have access to the admin console.
              {IS_DEMO && ' In demo mode, sign out and sign in as “Aaina Admin”.'}
            </p>
            <Link to="/" className="btn btn-dark">
              Back to home
            </Link>
          </div>
        </main>
      </>
    )
  return <Console />
}

type Tab = 'attention' | 'orders' | 'schedule' | 'log'

/** When the booking (re-)entered the awaiting-confirmation state. */
const awaitingSince = (b: Booking) =>
  [...b.timeline].reverse().find((t) => t.stage === 'awaiting-confirmation')?.at ?? b.paidAt ?? b.createdAt

const needsConfirmation = (b: Booking) => b.consultation?.status === 'awaiting-confirmation'

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

function beep() {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    g.gain.setValueAtTime(0.15, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6)
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.6)
  } catch {
    /* audio unavailable */
  }
}

function Console() {
  const backend = useBackend()
  const [bookings, setBookings] = useState<Booking[] | undefined>()
  const [outbox, setOutbox] = useState<OutboxMessage[]>([])
  const [tab, setTab] = useState<Tab>('attention')
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([])
  const [notifPerm, setNotifPerm] = useState(() => ('Notification' in window ? Notification.permission : 'denied'))
  const seen = useRef<Set<string> | null>(null)

  useEffect(() => backend.watchAllBookings(setBookings), [backend])
  useEffect(() => backend.watchOutbox(setOutbox), [backend])

  // Alert on every new booking/slot request that needs confirmation.
  useEffect(() => {
    if (!bookings) return
    const keys = new Set(bookings.filter(needsConfirmation).map((b) => b.id + awaitingSince(b)))
    if (seen.current) {
      const fresh = bookings.filter((b) => needsConfirmation(b) && !seen.current!.has(b.id + awaitingSince(b)))
      for (const b of fresh) {
        const text = `New slot request: ${b.customer.name} · ${formatDate(b.consultation!.date)} ${formatTime(b.consultation!.time)}`
        setToasts((t) => [...t, { id: b.id + Date.now(), text }])
        beep()
        if (notifPerm === 'granted') new Notification('Aaina — confirm within 30 min', { body: text })
      }
    }
    seen.current = keys
  }, [bookings, notifPerm])

  useEffect(() => {
    if (!toasts.length) return
    const t = setTimeout(() => setToasts((x) => x.slice(1)), 7000)
    return () => clearTimeout(t)
  }, [toasts])

  const pending = bookings?.filter(needsConfirmation).length ?? 0
  useEffect(() => {
    document.title = pending ? `(${pending}) Admin · Aaina` : 'Admin · Aaina'
    return () => {
      document.title = 'Aaina — Cancer Hair Care & Wig Consultations'
    }
  }, [pending])

  if (!bookings) return <><Navbar /><PageLoader /></>

  const today = nowIST().date
  const revenue = bookings.reduce((s, b) => s + b.amount, 0)
  const ready = bookings.filter((b) => b.delivery?.enabled && !b.delivery.date).length
  const upcoming = bookings.filter(
    (b) => (b.consultation?.status === 'confirmed' && b.consultation.date >= today) || (b.delivery?.date && b.delivery.date >= today && b.stage !== 'delivered'),
  ).length

  return (
    <>
      <Navbar />
      <main className="page admin">
        <div className="container">
          <div className="admin__head">
            <div>
              <p className="eyebrow">Admin Console</p>
              <h2 className="h2">Bookings & Orders</h2>
            </div>
            {notifPerm !== 'granted' && 'Notification' in window && (
              <button
                className="btn btn-ghost-dark btn-sm"
                onClick={() => Notification.requestPermission().then(setNotifPerm)}
              >
                <Bell size={15} /> Enable desktop alerts
              </button>
            )}
            {notifPerm === 'granted' && (
              <span className="badge badge-done">
                <BellRing size={13} /> Desktop alerts on
              </span>
            )}
          </div>

          <div className="stats">
            <Stat icon={Clock} label="Awaiting confirmation" value={pending} tone={pending ? 'warn' : undefined} />
            <Stat icon={CalendarClock} label="Upcoming appointments" value={upcoming} />
            <Stat icon={Truck} label="Ready, delivery not booked" value={ready} />
            <Stat icon={IndianRupee} label="Total collected" value={formatINR(revenue)} />
          </div>

          <div className="tabs" role="tablist">
            {(
              [
                ['attention', `Needs confirmation${pending ? ` (${pending})` : ''}`],
                ['orders', 'All orders'],
                ['schedule', 'Schedule'],
                ['log', 'Notification log'],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'attention' && <Attention bookings={bookings} />}
          {tab === 'orders' && <AllOrders bookings={bookings} />}
          {tab === 'schedule' && <Schedule bookings={bookings} />}
          {tab === 'log' && <Log messages={outbox} />}
        </div>
      </main>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast" onClick={() => setTab('attention')}>
            <BellRing size={16} /> {t.text}
          </div>
        ))}
      </div>
    </>
  )
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Clock; label: string; value: string | number; tone?: 'warn' }) {
  return (
    <div className={'stat card' + (tone ? ' stat--' + tone : '')}>
      <Icon size={18} />
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function useAction(bookingId: string) {
  const backend = useBackend()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async (action: AdminAction) => {
    setBusy(true)
    setError('')
    try {
      await backend.adminAction(bookingId, action)
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}

function Attention({ bookings }: { bookings: Booking[] }) {
  const list = bookings.filter(needsConfirmation).sort((a, b) => awaitingSince(a) - awaitingSince(b))
  if (!list.length)
    return (
      <div className="card empty">
        <Check size={28} />
        <h3>All caught up</h3>
        <p className="muted">New consultation requests will appear here with an alert.</p>
      </div>
    )
  return (
    <div className="attention">
      {list.map((b) => (
        <ConfirmCard key={b.id} booking={b} />
      ))}
    </div>
  )
}

function ConfirmCard({ booking: b }: { booking: Booking }) {
  const now = useNow()
  const { busy, error, run } = useAction(b.id)
  const [rescheduling, setRescheduling] = useState(false)
  const [note, setNote] = useState('')
  const left = awaitingSince(b) + CONFIRM_WITHIN_MS - now
  const overdue = left <= 0
  const mins = Math.floor(Math.abs(left) / 60_000)
  const secs = Math.floor((Math.abs(left) % 60_000) / 1000)
  const c = b.consultation!

  return (
    <div className={'card confirm' + (overdue ? ' confirm--overdue' : '')}>
      <div className="confirm__timer">
        <Clock size={16} />
        {overdue ? `Overdue by ${mins}m` : `${mins}:${String(secs).padStart(2, '0')} left`}
      </div>
      <div className="confirm__body">
        <h3>{b.customer.name}</h3>
        <p className="muted small">
          {PRODUCTS[b.product].name} · {b.id} · {formatINR(b.amount)} paid
        </p>
        <p className="slot-text">
          {formatDate(c.date)}, {formatTime(c.time)}
        </p>
        <p className="small">
          <a href={`mailto:${b.customer.email}`}>{b.customer.email}</a> ·{' '}
          <a href={`https://wa.me/${b.customer.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
            {b.customer.phone}
          </a>
        </p>
      </div>
      {rescheduling ? (
        <div className="confirm__actions">
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note, e.g. 'Could you do Thursday afternoon?'"
          />
          <button className="btn btn-dark btn-sm" disabled={busy} onClick={() => run({ type: 'request-reschedule', note })}>
            Send request
          </button>
          <button className="btn btn-ghost-dark btn-sm" onClick={() => setRescheduling(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="confirm__actions">
          <button className="btn btn-gold btn-sm" disabled={busy} onClick={() => run({ type: 'confirm-consultation' })}>
            <Check size={15} /> Confirm & email
          </button>
          <button className="btn btn-ghost-dark btn-sm" disabled={busy} onClick={() => setRescheduling(true)}>
            Ask to reschedule
          </button>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}

function AllOrders({ bookings }: { bookings: Booking[] }) {
  const [q, setQ] = useState('')
  const [product, setProduct] = useState<ProductId | ''>('')
  const [openId, setOpenId] = useState<string | null>(null)
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return bookings.filter(
      (b) =>
        (!product || b.product === product) &&
        (!s || [b.id, b.customer.name, b.customer.email, b.customer.phone].some((v) => v.toLowerCase().includes(s))),
    )
  }, [bookings, q, product])

  return (
    <div>
      <div className="filters">
        <label className="search">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone or order ID" />
        </label>
        <select className="input" value={product} onChange={(e) => setProduct(e.target.value as ProductId | '')}>
          <option value="">All services</option>
          {Object.values(PRODUCTS).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {!list.length && <p className="muted center">No orders match.</p>}
      <div className="admin-orders">
        {list.map((b) => (
          <div key={b.id} className={'card admin-order' + (openId === b.id ? ' is-open' : '')}>
            <button className="admin-order__row" onClick={() => setOpenId(openId === b.id ? null : b.id)}>
              <span>
                <strong>{b.customer.name}</strong>
                <small className="muted">
                  {b.id} · {PRODUCTS[b.product].name}
                </small>
              </span>
              <StatusBadge booking={b} />
              <span className="admin-order__amt">{formatINR(b.amount)}</span>
              <ChevronDown size={18} className="admin-order__chev" />
            </button>
            {openId === b.id && <OrderPanel booking={b} />}
          </div>
        ))}
      </div>
    </div>
  )
}

function OrderPanel({ booking: b }: { booking: Booking }) {
  const { busy, error, run } = useAction(b.id)
  const [stage, setStage] = useState(b.stage)
  const [note, setNote] = useState('')
  const c = b.consultation
  const d = b.delivery

  return (
    <div className="admin-order__panel">
      <div className="kv">
        <div>
          <span>Customer</span>
          <p>
            {b.customer.name}
            <br />
            <a href={`mailto:${b.customer.email}`}>{b.customer.email}</a>
            <br />
            <a href={`https://wa.me/${b.customer.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
              {b.customer.phone}
            </a>
          </p>
        </div>
        <div>
          <span>Payment</span>
          <p>
            {formatINR(b.amount)} · {new Date(b.paidAt!).toLocaleString('en-IN')}
            <br />
            <small className="muted">{b.paymentRef}</small>
          </p>
        </div>
        {c && (
          <div>
            <span>Consultation</span>
            <p>
              {formatDate(c.date)}, {formatTime(c.time)}
              <br />
              <small className="muted">{c.status.replace(/-/g, ' ')}</small>
            </p>
          </div>
        )}
        {d && (
          <div>
            <span>Delivery</span>
            <p>
              {d.date ? `${formatDate(d.date)}, ${formatTime(d.time!)}` : d.enabled ? 'Enabled — awaiting customer' : 'Not enabled yet'}
              {d.address && (
                <>
                  <br />
                  <small className="muted">{d.address}</small>
                </>
              )}
            </p>
          </div>
        )}
      </div>

      <div className="panel-actions">
        {c?.status === 'awaiting-confirmation' && (
          <button className="btn btn-gold btn-sm" disabled={busy} onClick={() => run({ type: 'confirm-consultation' })}>
            <Check size={15} /> Confirm consultation
          </button>
        )}
        {hasDelivery(b.product) && !d?.enabled && (
          <button className="btn btn-gold btn-sm" disabled={busy} onClick={() => run({ type: 'enable-delivery' })}>
            <Truck size={15} /> Wig ready — enable delivery booking
          </button>
        )}
      </div>

      <div className="stage-form">
        <label className="field">
          <span>Order status</span>
          <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
            {STAGES[b.product].map((s, i) => (
              <option key={s.id + i} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Note to customer (optional)</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Haircut scheduled for Monday 3 PM" />
        </label>
        <button
          className="btn btn-dark btn-sm"
          disabled={busy || (stage === b.stage && !note)}
          onClick={async () => {
            if (await run({ type: 'set-stage', stage, note })) setNote('')
          }}
        >
          <MessageCircle size={15} /> Update & send WhatsApp
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}

function Schedule({ bookings }: { bookings: Booking[] }) {
  const today = nowIST().date
  const items = bookings
    .flatMap((b) => {
      const out: { date: string; time: string; kind: string; b: Booking; tentative: boolean }[] = []
      if (b.consultation && b.consultation.status !== 'reschedule-requested' && b.consultation.date >= today)
        out.push({ ...b.consultation, kind: 'Consultation', b, tentative: b.consultation.status !== 'confirmed' })
      if (b.delivery?.date && b.delivery.date >= today && b.stage !== 'delivered')
        out.push({ date: b.delivery.date, time: b.delivery.time!, kind: 'Delivery', b, tentative: false })
      return out
    })
    .sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time))

  if (!items.length) return <div className="card empty"><h3>Nothing scheduled</h3><p className="muted">Upcoming consultations and deliveries will appear here.</p></div>

  const byDate: Record<string, typeof items> = {}
  for (const i of items) (byDate[i.date] ??= []).push(i)
  return (
    <div className="schedule">
      {Object.entries(byDate).map(([date, list]) => (
        <div key={date} className="card">
          <h3>{formatDate(date)}</h3>
          {list.map((i) => (
            <div key={i.b.id + i.kind} className="schedule__item">
              <strong>{formatTime(i.time)}</strong>
              <span className={'badge ' + (i.kind === 'Delivery' ? 'badge-gold' : 'badge-rose')}>{i.kind}</span>
              <span>
                {i.b.customer.name} <small className="muted">· {i.b.customer.phone}</small>
              </span>
              {i.tentative && <span className="badge badge-warn">Unconfirmed</span>}
              {i.kind === 'Delivery' && <small className="muted schedule__addr">{i.b.delivery?.address}</small>}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function Log({ messages }: { messages: OutboxMessage[] }) {
  if (!messages.length) return <div className="card empty"><h3>No messages yet</h3><p className="muted">Emails and WhatsApp messages sent to customers and admins are logged here.</p></div>
  return (
    <div className="log">
      {messages.map((m) => (
        <div key={m.id} className="card log__item">
          <span className={'log__icon log__icon--' + m.channel}>
            {m.channel === 'email' ? <Mail size={16} /> : <MessageCircle size={16} />}
          </span>
          <div>
            <p className="small muted">
              {m.channel === 'email' ? 'Email' : 'WhatsApp'} to <strong>{m.to}</strong> · {new Date(m.at).toLocaleString('en-IN')} · {m.bookingId}
            </p>
            {m.subject && <h4>{m.subject}</h4>}
            <p className="log__body">{m.body}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
