import { CalendarCheck, CheckCircle2, Clock, Info, MessageCircle, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { Eyebrow, Page, PageLoader } from '../components/Layout'
import { SlotPicker } from '../components/SlotPicker'
import { useBackend, useBooking } from '../lib/app-context'
import { PRODUCTS, STAGES, formatDate, formatINR, formatTime, slotEnd } from '../shared/catalog'
import type { Booking, Slot } from '../shared/types'
import { StatusBadge } from './Orders'

export default function OrderDetail() {
  const { id } = useParams()
  const booking = useBooking(id)
  const { hash } = useLocation()

  useEffect(() => {
    if (booking && hash) document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [booking, hash])

  if (booking === undefined) return <Page><PageLoader /></Page>
  if (booking === null) return <Navigate to="/orders" replace />
  if (booking.paymentStatus !== 'paid') return <Navigate to={`/checkout/${booking.id}`} replace />

  return (
    <Page>
      <section className="section section--top">
        <div className="container">
          <Link to="/orders" className="back-link">
            ← All orders
          </Link>
          <div className="order-head">
            <div>
              <Eyebrow>Order {booking.id}</Eyebrow>
              <h2 className="h2">{PRODUCTS[booking.product].name}</h2>
              <p className="muted">
                Paid {formatINR(booking.amount)} on{' '}
                {new Date(booking.paidAt!).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <StatusBadge booking={booking} />
          </div>

          <div className="order-grid">
            <div className="order-actions">
              {booking.consultation && <ConsultationCard booking={booking} />}
              {booking.delivery && <DeliveryCard booking={booking} />}
              <div className="card notice notice--soft">
                <MessageCircle size={20} />
                <p className="muted">
                  We send updates and reminders on WhatsApp to <strong>{booking.customer.phone}</strong> and by email to{' '}
                  <strong>{booking.customer.email}</strong>.
                </p>
              </div>
            </div>
            <Timeline booking={booking} />
          </div>
        </div>
      </section>
    </Page>
  )
}

function ConsultationCard({ booking }: { booking: Booking }) {
  const c = booking.consultation!
  const backend = useBackend()
  const [slot, setSlot] = useState<Slot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const when = `${formatDate(c.date)}, ${formatTime(c.time)} – ${formatTime(slotEnd('consultation', c.time))}`

  if (c.status === 'reschedule-requested') {
    return (
      <div className="card card--accent">
        <h3 className="card__title">
          <CalendarCheck size={18} /> Please choose a new consultation slot
        </h3>
        <p className="muted">
          We're sorry, we couldn't hold {when}.{c.note ? ` ${c.note}` : ''}
        </p>
        <SlotPicker kind="consultation" value={slot} onChange={setSlot} />
        {error && <p className="form-error">{error}</p>}
        <button
          className="btn btn-gold"
          disabled={!slot || busy}
          onClick={async () => {
            setBusy(true)
            setError('')
            try {
              await backend.rescheduleConsultation(booking.id, slot!)
            } catch (e) {
              setError((e as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy && <span className="spinner spinner--sm" />} Request this slot
        </button>
      </div>
    )
  }

  const confirmed = c.status === 'confirmed'
  return (
    <div className={'card status-card ' + (confirmed ? 'status-card--ok' : 'status-card--wait')}>
      {confirmed ? <CheckCircle2 size={22} /> : <Clock size={22} />}
      <div>
        <h3>{confirmed ? 'Consultation confirmed' : 'Awaiting confirmation'}</h3>
        <p className="slot-text">{when} IST</p>
        <p className="muted small">
          {confirmed
            ? 'We look forward to meeting you. A confirmation has been sent to your email.'
            : "Our team confirms slots within 30 minutes. You'll receive an email and WhatsApp message."}
        </p>
      </div>
    </div>
  )
}

function DeliveryCard({ booking }: { booking: Booking }) {
  const d = booking.delivery!
  const backend = useBackend()
  const [slot, setSlot] = useState<Slot | null>(null)
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!d.enabled) {
    return (
      <div className="card status-card status-card--idle" id="delivery">
        <Truck size={22} />
        <div>
          <h3>Delivery</h3>
          <p className="muted small">
            When your wig is ready, we'll email you a link to book a personalised delivery slot — you'll also be able to
            book it right here.
          </p>
        </div>
      </div>
    )
  }

  if (d.date && d.time) {
    return (
      <div className="card status-card status-card--ok" id="delivery">
        <Truck size={22} />
        <div>
          <h3>{booking.stage === 'delivered' ? 'Delivered' : 'Delivery scheduled'}</h3>
          <p className="slot-text">
            {formatDate(d.date)}, {formatTime(d.time)} – {formatTime(slotEnd('delivery', d.time))} IST
          </p>
          <p className="muted small">{d.address}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card card--accent" id="delivery">
      <h3 className="card__title">
        <Truck size={18} /> Your wig is ready — book your delivery
      </h3>
      <p className="muted">Choose a 15-minute window and we'll bring your wig to you for a personalised fitting.</p>
      <SlotPicker kind="delivery" value={slot} onChange={setSlot} />
      <label className="field">
        <span>Delivery address</span>
        <textarea
          rows={3}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="House / flat, street, area, city, PIN code"
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button
        className="btn btn-gold"
        disabled={!slot || address.trim().length < 10 || busy}
        onClick={async () => {
          setBusy(true)
          setError('')
          try {
            await backend.bookDelivery(booking.id, slot!, address)
          } catch (e) {
            setError((e as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy && <span className="spinner spinner--sm" />} Book delivery slot
      </button>
      <p className="hint">
        <Info size={14} /> Delivery slots are Monday – Friday, 11 AM – 7 PM.
      </p>
    </div>
  )
}

function Timeline({ booking }: { booking: Booking }) {
  const stages = STAGES[booking.product]
  const current = stages.findIndex((s) => s.id === booking.stage)
  const when = (stageId: string) => [...booking.timeline].reverse().find((t) => t.stage === stageId)
  return (
    <div className="card timeline">
      <h3>Order status</h3>
      <ol>
        {stages.map((s, i) => {
          const entry = when(s.id)
          const state = i < current ? 'done' : i === current ? 'current' : 'todo'
          return (
            <li key={s.id + i} className={'tl tl--' + state}>
              <span className="tl__dot" />
              <div>
                <strong>{s.label}</strong>
                <p className="muted small">{entry?.note || s.description}</p>
                {entry && i <= current && (
                  <time className="small">
                    {new Date(entry.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </time>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
