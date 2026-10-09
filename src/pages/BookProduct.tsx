import { ArrowRight, Check, Info, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Eyebrow, Page, PageLoader } from '../components/Layout'
import { SlotPicker } from '../components/SlotPicker'
import { useAuth, useBackend } from '../lib/app-context'
import {
  CONSULTATION_PRICE,
  PRODUCTS,
  WIG_PRICE,
  formatDate,
  formatINR,
  formatTime,
  priceFor,
  type ProductId,
} from '../shared/catalog'
import type { Slot } from '../shared/types'

const PHONE_KEY = 'aaina-phone'

export default function BookProduct() {
  const { product: param } = useParams()
  const productId = param as ProductId
  const product = PRODUCTS[productId]
  const backend = useBackend()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [consulted, setConsulted] = useState<boolean | null>(null)
  const [slot, setSlot] = useState<Slot | null>(null)
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(() => {
    try {
      return localStorage.getItem(PHONE_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    backend.hasPaidConsultation().then(setConsulted, () => setConsulted(false))
  }, [backend])

  if (!product) return <Navigate to="/book" replace />
  if (consulted === null) return <Page><PageLoader /></Page>

  const amount = priceFor(productId, consulted)
  const credit = productId === 'wig-only' || (productId === 'natural-wig' && consulted)
  const blocked = productId === 'wig-only' && !consulted
  const needsSlot = product.needsConsultationSlot
  const canContinue = !blocked && (!needsSlot || slot) && phone.trim().length >= 10 && name.trim().length > 1

  async function submit() {
    setBusy(true)
    setError('')
    try {
      try {
        localStorage.setItem(PHONE_KEY, phone.trim())
      } catch {
        /* storage unavailable */
      }
      const id = await backend.createBooking({ product: productId, slot: slot ?? undefined, name: name.trim(), phone })
      navigate(`/checkout/${id}`)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Page>
      <section className="section section--top">
        <div className="container">
          <Link to="/book" className="back-link">
            ← All options
          </Link>
          <Eyebrow>{product.cta}</Eyebrow>
          <h2 className="h2">{product.name}</h2>
          <p className="lead narrow">{product.tagline}</p>

          <div className="booking">
            <div className="booking__main">
              {blocked ? (
                <div className="card notice">
                  <Info size={20} />
                  <div>
                    <h3>We couldn't find a consultation on your account</h3>
                    <p className="muted">
                      This option is for people who have already booked and paid for a consultation with us using{' '}
                      <strong>{user?.email}</strong>. If you haven't yet, the Complete Wig Package includes your
                      consultation — or start with a consultation on its own.
                    </p>
                    <div className="btn-row">
                      <Link to="/book/complete-package" className="btn btn-gold btn-sm">
                        Book Complete Wig Package
                      </Link>
                      <Link to="/book/consultation" className="btn btn-ghost-dark btn-sm">
                        Book a Consultation
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {needsSlot && (
                    <div className="card">
                      <h3 className="card__title">
                        <span className="step">1</span> Choose your consultation slot
                      </h3>
                      <SlotPicker kind="consultation" value={slot} onChange={setSlot} />
                      <p className="hint">
                        <Info size={14} /> After payment, our team confirms your slot within 30 minutes. You'll get an
                        email and a WhatsApp message.
                      </p>
                    </div>
                  )}
                  {!needsSlot && productId !== 'consultation' && (
                    <div className="card notice notice--soft">
                      <Info size={20} />
                      <p className="muted">
                        {productId === 'wig-only'
                          ? "We'll reach out on WhatsApp to schedule your haircut. Once your wig is ready, you'll be able to book a delivery slot here."
                          : "Once your wig is prepared, we'll email you a link to book a personalised delivery slot."}
                      </p>
                    </div>
                  )}
                  <div className="card">
                    <h3 className="card__title">
                      <span className="step">{needsSlot ? 2 : 1}</span> Your details
                    </h3>
                    <div className="form-grid">
                      <label className="field">
                        <span>Full name</span>
                        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                      </label>
                      <label className="field">
                        <span>WhatsApp number</span>
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          inputMode="tel"
                          autoComplete="tel"
                        />
                      </label>
                      <label className="field field--wide">
                        <span>Email</span>
                        <input value={user?.email ?? ''} disabled />
                      </label>
                    </div>
                    <p className="hint">
                      <Info size={14} /> We'll send order updates and reminders to this WhatsApp number.
                    </p>
                  </div>
                </>
              )}
            </div>

            <aside className="summary card">
              <h3>Order summary</h3>
              <ul className="checks">
                {product.includes.map((i) => (
                  <li key={i}>
                    <Check size={14} /> {i}
                  </li>
                ))}
              </ul>
              {slot && (
                <div className="summary__slot">
                  <span>Consultation</span>
                  <strong>
                    {formatDate(slot.date)} · {formatTime(slot.time)}
                  </strong>
                </div>
              )}
              <div className="summary__lines">
                <div>
                  <span>{product.name}</span>
                  <span>{formatINR(productId === 'consultation' ? CONSULTATION_PRICE : WIG_PRICE)}</span>
                </div>
                {credit && !blocked && (
                  <div className="credit">
                    <span>Consultation already paid</span>
                    <span>−{formatINR(CONSULTATION_PRICE)}</span>
                  </div>
                )}
                <div className="summary__total">
                  <span>Total</span>
                  <span>{formatINR(amount)}</span>
                </div>
              </div>
              {error && <p className="form-error">{error}</p>}
              <button className="btn btn-gold btn-block" disabled={!canContinue || busy} onClick={submit}>
                {busy ? <span className="spinner spinner--sm" /> : null}
                Continue to payment <ArrowRight size={16} />
              </button>
              {!blocked && !canContinue && (
                <p className="hint center">
                  {needsSlot && !slot ? 'Pick a slot and add your details to continue' : 'Add your name and WhatsApp number to continue'}
                </p>
              )}
              <p className="fine">
                <Lock size={12} /> Secure payment · UPI, cards & netbanking
              </p>
            </aside>
          </div>
        </div>
      </section>
    </Page>
  )
}
