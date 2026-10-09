import { CheckCircle2, Clock, Lock, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Eyebrow, Page, PageLoader } from '../components/Layout'
import { useBackend, useBooking } from '../lib/app-context'
import { IS_DEMO } from '../lib/config'
import { CONSULTATION_PRICE, PRODUCTS, WIG_PRICE, formatDate, formatINR, formatTime } from '../shared/catalog'

function useCountdown(until?: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!until) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [until])
  if (!until) return null
  const s = Math.max(0, Math.floor((until - now) / 1000))
  return { expired: s === 0, label: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
}

export default function Checkout() {
  const { id } = useParams()
  const booking = useBooking(id)
  const backend = useBackend()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const countdown = useCountdown(booking?.paymentStatus === 'pending' ? booking.holdUntil : undefined)

  if (booking === undefined) return <Page><PageLoader /></Page>
  if (booking === null) return <Navigate to="/orders" replace />

  const product = PRODUCTS[booking.product]
  const paid = booking.paymentStatus === 'paid'
  const listPrice = booking.product === 'consultation' ? CONSULTATION_PRICE : WIG_PRICE
  const credit = listPrice - booking.amount

  async function pay() {
    setBusy(true)
    setError('')
    try {
      await backend.pay(booking!.id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page>
      <section className="section section--top">
        <div className="container checkout">
          {paid ? (
            <div className="card success">
              <CheckCircle2 size={44} className="success__icon" />
              <h2 className="h2">Thank you, {booking.customer.name.split(' ')[0]}</h2>
              <p className="lead">
                Your payment of <strong>{formatINR(booking.amount)}</strong> was successful.
                {booking.consultation
                  ? ' Our team will confirm your consultation slot within 30 minutes — look out for an email and WhatsApp message.'
                  : " We'll keep you updated on WhatsApp at every step."}
              </p>
              <p className="muted small">Order reference: {booking.id}</p>
              <div className="btn-row center">
                <button className="btn btn-dark" onClick={() => navigate(`/orders/${booking.id}`)}>
                  Track your order
                </button>
                <Link to="/resources" className="btn btn-ghost-dark">
                  Wig care resources
                </Link>
              </div>
            </div>
          ) : (
            <div className="checkout__grid">
              <div>
                <Eyebrow>Payment</Eyebrow>
                <h2 className="h2">Complete your booking</h2>
                <p className="lead">Review your order and pay securely to reserve your place.</p>
                {countdown && booking.consultation && (
                  <p className={'hold' + (countdown.expired ? ' hold--expired' : '')}>
                    <Clock size={16} />
                    {countdown.expired
                      ? 'Your slot hold has expired — you can still pay if the slot is free.'
                      : `We're holding your slot for ${countdown.label}`}
                  </p>
                )}
                <ul className="trust">
                  <li>
                    <ShieldCheck size={18} /> Payments processed securely by Razorpay — UPI, cards, netbanking & wallets
                  </li>
                  <li>
                    <Lock size={18} /> We never see or store your card details
                  </li>
                </ul>
              </div>

              <div className="card summary">
                <h3>{product.name}</h3>
                <p className="muted small">Ref {booking.id}</p>
                {booking.consultation && (
                  <div className="summary__slot">
                    <span>Consultation</span>
                    <strong>
                      {formatDate(booking.consultation.date)} · {formatTime(booking.consultation.time)}
                    </strong>
                  </div>
                )}
                <div className="summary__lines">
                  <div>
                    <span>{product.name}</span>
                    <span>{formatINR(listPrice)}</span>
                  </div>
                  {credit > 0 && (
                    <div className="credit">
                      <span>Consultation already paid</span>
                      <span>−{formatINR(credit)}</span>
                    </div>
                  )}
                  <div className="summary__total">
                    <span>Amount payable</span>
                    <span>{formatINR(booking.amount)}</span>
                  </div>
                </div>
                {error && <p className="form-error">{error}</p>}
                <button className="btn btn-gold btn-block" disabled={busy} onClick={pay}>
                  {busy && <span className="spinner spinner--sm" />}
                  {busy ? 'Processing…' : `Pay ${formatINR(booking.amount)}`}
                </button>
                {IS_DEMO && <p className="fine">Demo mode: payment is simulated, no money is charged.</p>}
              </div>
            </div>
          )}
        </div>
      </section>
    </Page>
  )
}
