import { ArrowRight, Package } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Eyebrow, Page, PageLoader } from '../components/Layout'
import { useMyBookings } from '../lib/app-context'
import { PRODUCTS, formatINR, stageLabel } from '../shared/catalog'
import type { Booking } from '../shared/types'

export function StatusBadge({ booking }: { booking: Booking }) {
  if (booking.paymentStatus !== 'paid') return <span className="badge badge-muted">Payment pending</span>
  if (booking.consultation?.status === 'reschedule-requested') return <span className="badge badge-warn">Pick a new slot</span>
  const tone =
    booking.stage === 'delivered' || booking.stage === 'consultation-done'
      ? 'badge-done'
      : booking.stage === 'awaiting-confirmation'
        ? 'badge-warn'
        : booking.stage === 'wig-ready'
          ? 'badge-gold'
          : 'badge-rose'
  return <span className={'badge ' + tone}>{stageLabel(booking.product, booking.stage)}</span>
}

export default function Orders() {
  const bookings = useMyBookings()
  return (
    <Page>
      <section className="section section--top">
        <div className="container">
          <Eyebrow>Your Orders</Eyebrow>
          <h2 className="h2">Track Your Journey</h2>
          <p className="lead narrow">Every booking and its progress, in one place. We also send updates on WhatsApp.</p>

          {bookings === undefined ? (
            <PageLoader />
          ) : bookings.length === 0 ? (
            <div className="card empty">
              <Package size={32} />
              <h3>No bookings yet</h3>
              <p className="muted">When you book a consultation or a wig, you'll be able to follow it here.</p>
              <Link to="/book" className="btn btn-gold">
                Book now
              </Link>
            </div>
          ) : (
            <div className="order-list">
              {bookings.map((b) => (
                <Link
                  key={b.id}
                  to={b.paymentStatus === 'paid' ? `/orders/${b.id}` : `/checkout/${b.id}`}
                  className="order-row card"
                >
                  <div>
                    <h3>{PRODUCTS[b.product].name}</h3>
                    <p className="muted small">
                      {b.id} · {new Date(b.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <StatusBadge booking={b} />
                  <strong className="order-row__amt">{formatINR(b.amount)}</strong>
                  <ArrowRight size={18} className="order-row__arrow" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </Page>
  )
}
