import { ArrowRight, Check, Gem, Scissors, Sparkles, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Eyebrow, Page } from '../components/Layout'
import { CONSULTATION_PRICE, PRODUCTS, WIG_PRICE, formatINR, type ProductId } from '../shared/catalog'

const OPTIONS: { id: ProductId; icon: typeof Gem; price: string; note?: string; featured?: boolean }[] = [
  { id: 'consultation', icon: UserRound, price: formatINR(CONSULTATION_PRICE) },
  { id: 'complete-package', icon: Sparkles, price: formatINR(WIG_PRICE), featured: true },
  {
    id: 'wig-only',
    icon: Scissors,
    price: formatINR(WIG_PRICE - CONSULTATION_PRICE),
    note: `${formatINR(WIG_PRICE)} minus your ${formatINR(CONSULTATION_PRICE)} consultation`,
  },
  {
    id: 'natural-wig',
    icon: Gem,
    price: formatINR(WIG_PRICE),
    note: `${formatINR(CONSULTATION_PRICE)} off if you've had a consultation with us`,
  },
]

export default function Book() {
  return (
    <Page>
      <section className="section section--top">
        <div className="container">
          <div className="split-head">
            <div>
              <Eyebrow>Book with Aaina</Eyebrow>
              <h2 className="h2">
                Choose What <em>Feels</em>
                <br />
                <em>Right for You</em>
              </h2>
            </div>
            <p className="muted">
              Not sure where to start? Book a consultation — and if you go ahead with a wig later, we'll deduct the
              {' ' + formatINR(CONSULTATION_PRICE)} from your wig package.
            </p>
          </div>

          <div className="options">
            {OPTIONS.map(({ id, icon: Icon, price, note, featured }) => {
              const p = PRODUCTS[id]
              return (
                <article key={id} className={'option' + (featured ? ' option--featured' : '')}>
                  {featured && <span className="badge badge-gold">Most chosen</span>}
                  <span className="icon-tile">
                    <Icon size={20} />
                  </span>
                  <h3>{p.name}</h3>
                  <p className="muted">{p.tagline}</p>
                  <ul className="checks">
                    {p.includes.map((i) => (
                      <li key={i}>
                        <Check size={14} /> {i}
                      </li>
                    ))}
                  </ul>
                  <div className="option__price">
                    <strong>{price}</strong>
                    {note && <small>{note}</small>}
                  </div>
                  <Link to={`/book/${id}`} className={'btn ' + (featured ? 'btn-gold' : 'btn-dark')}>
                    {p.cta} <ArrowRight size={16} />
                  </Link>
                </article>
              )
            })}
          </div>
        </div>
      </section>
    </Page>
  )
}
