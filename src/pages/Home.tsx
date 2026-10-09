import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarHeart,
  Gem,
  HeartHandshake,
  MessageCircle,
  Scissors,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRound,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eyebrow, Page } from '../components/Layout'
import { TEAM, TESTIMONIALS } from '../content/site'
import { CONSULTATION_PRICE, PRODUCTS, WIG_PRICE, formatINR, type ProductId } from '../shared/catalog'

export default function Home() {
  return (
    <Page overlayNav>
      <Hero />
      <TwoPaths />
      <Services />
      <HowItWorks />
      <WhyUs />
      <Testimonials />
      <Team />
      <FinalCta />
    </Page>
  )
}

function Hero() {
  return (
    <section className="hero" style={{ backgroundImage: 'url(/images/hero.jpg)' }}>
      <div className="hero__shade" />
      <div className="container hero__inner">
        <h1 className="display">
          A Safe Space to <em>Feel</em>
          <br />
          <em>Like Yourself Again</em>
        </h1>
        <div className="hero__mid">
          <span>Step into care</span>
          <span>Begin with us</span>
        </div>
        <div className="hero__bottom">
          <div className="hero__copy">
            <p>
              Consultations, custom wigs made from your own hair, and personalised delivery — gentle, private support
              for everyone going through cancer-related hair loss.
            </p>
            <div className="btn-row">
              <Link to="/book" className="btn btn-gold">
                Book an Appointment <ArrowRight size={16} />
              </Link>
              <Link to="/resources" className="btn btn-glass">
                Explore Resources
              </Link>
            </div>
          </div>
          <div className="glass-strip">
            <div>
              <Scissors size={18} />
              <span>Wigs crafted from your own hair</span>
            </div>
            <div>
              <ShieldCheck size={18} />
              <span>Private, compassionate consultations</span>
            </div>
            <div>
              <Truck size={18} />
              <span>Personalised delivery & fitting</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function TwoPaths() {
  return (
    <section className="section section--tight">
      <div className="container paths">
        <Link to="/book" className="path-card" style={{ backgroundImage: 'url(/images/services.jpg)' }}>
          <div className="path-card__shade" />
          <div className="path-card__body">
            <span className="icon-tile icon-tile--glass">
              <CalendarHeart size={20} />
            </span>
            <h3>Book your care</h3>
            <p>Consultations, complete wig packages and ready-made natural hair wigs.</p>
            <span className="path-card__cta">
              Go to booking <ArrowRight size={16} />
            </span>
          </div>
        </Link>
        <Link to="/resources" className="path-card" style={{ backgroundImage: 'url(/images/resources.jpg)' }}>
          <div className="path-card__shade" />
          <div className="path-card__body">
            <span className="icon-tile icon-tile--glass">
              <BookOpen size={20} />
            </span>
            <h3>Resources & wig care</h3>
            <p>Do's and don'ts, plus videos on putting on and caring for your wig.</p>
            <span className="path-card__cta">
              Explore resources <ArrowRight size={16} />
            </span>
          </div>
        </Link>
      </div>
    </section>
  )
}

const SERVICE_ICONS: Record<ProductId, typeof UserRound> = {
  consultation: UserRound,
  'complete-package': Sparkles,
  'wig-only': Scissors,
  'natural-wig': Gem,
}

const SERVICE_PRICE: Record<ProductId, string> = {
  consultation: formatINR(CONSULTATION_PRICE),
  'complete-package': formatINR(WIG_PRICE),
  'wig-only': formatINR(WIG_PRICE - CONSULTATION_PRICE),
  'natural-wig': formatINR(WIG_PRICE),
}

function Services() {
  return (
    <section className="section">
      <div className="container services">
        <div className="services__intro">
          <Eyebrow>Our Services</Eyebrow>
          <h2 className="h2">Care, Crafted Around You</h2>
          <p className="lead">
            From your first conversation to the moment your wig is fitted at home, we walk beside you — with expertise,
            patience and warmth.
          </p>
          <img src="/images/services.jpg" alt="A stylist gently working on a client's hair" className="services__img" />
        </div>
        <div className="services__grid">
          {(Object.keys(PRODUCTS) as ProductId[]).map((id) => {
            const Icon = SERVICE_ICONS[id]
            return (
              <div key={id} className="service">
                <div className="service__head">
                  <span className="icon-tile">
                    <Icon size={18} />
                  </span>
                  <h3>{PRODUCTS[id].name}</h3>
                </div>
                <p>{PRODUCTS[id].tagline}</p>
                <div className="service__foot">
                  <span className="price">{SERVICE_PRICE[id]}</span>
                  <Link to={`/book/${id}`} className="link-underline">
                    Book now
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  {
    title: 'Book a Consultation',
    text: 'Pick a 30-minute slot that suits you. We confirm it within 30 minutes by email and WhatsApp.',
  },
  {
    title: 'Haircut & Crafting',
    text: 'We cut and collect your hair with care, then our artisans craft your wig — with updates at every stage.',
  },
  {
    title: 'Personalised Delivery',
    text: "When your wig is ready, choose a delivery slot. We'll fit it and show you how to care for it.",
  },
]

function HowItWorks() {
  return (
    <section className="section how">
      <div className="container how__head">
        <Eyebrow>How it Works</Eyebrow>
        <h2 className="h2 how__title">
          <em>We Guide You Through</em>
          <br />
          Every Step of the Way
        </h2>
      </div>
      <div className="how__band" style={{ backgroundImage: 'url(/images/journey.jpg)' }}>
        <div className="container">
          <div className="how__cards">
            {STEPS.map((s, i) => (
              <div key={s.title} className="glass-card">
                <span className="glass-card__num">0{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
          <div className="center">
            <Link to="/book" className="btn btn-light">
              Book a Session
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

const FEATURES = [
  { icon: Scissors, title: 'Your Own Hair', text: 'Custom wigs made from your own hair, so you still feel like you.' },
  { icon: HeartHandshake, title: 'Private & Dignified', text: 'One-on-one sessions in a calm, judgement-free setting.' },
  { icon: MessageCircle, title: 'Always in the Loop', text: 'Email confirmations and WhatsApp updates at every stage.' },
  { icon: Gem, title: 'Thoughtful Pricing', text: 'Already consulted? Your ₹499 is deducted from your wig.' },
]

function WhyUs() {
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % FEATURES.length), 4500)
    return () => clearInterval(t)
  }, [])
  return (
    <section className="section">
      <div className="container">
        <div className="why">
          <div className="why__text">
            <div>
              <Eyebrow>Why Choose Us</Eyebrow>
              <h2 className="h2">
                Trusted Care <em>for</em>
                <br />
                <em>Every Journey</em>
              </h2>
            </div>
            <div>
              <p className="lead">
                Hair loss during treatment can feel like losing a part of yourself. With experienced consultants,
                skilled wig artisans and a process built around your comfort, Aaina helps you face the mirror with
                confidence again.
              </p>
              <Link to="/book/consultation" className="btn btn-dark">
                Book a Consultation
              </Link>
            </div>
          </div>
          <img src="/images/why.jpg" alt="A woman with long, healthy hair against a soft pink wall" className="why__img" />
        </div>
        <div className="features">
          <div className="features__track">
            <span style={{ width: `${100 / FEATURES.length}%`, transform: `translateX(${active * 100}%)` }} />
          </div>
          {FEATURES.map((f, i) => (
            <button key={f.title} className={'feature' + (i === active ? ' is-active' : '')} onClick={() => setActive(i)}>
              <f.icon size={18} />
              <div>
                <h4>{f.title}</h4>
                <p>{f.text}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function Testimonials() {
  const [i, setI] = useState(0)
  const t = TESTIMONIALS[i]
  const [before, after] = t.quote.split(t.highlight)
  const go = (d: number) => setI((i + d + TESTIMONIALS.length) % TESTIMONIALS.length)
  return (
    <section className="section">
      <div className="container testimonial">
        <div className="testimonial__side">
          <Eyebrow>Testimonials</Eyebrow>
          <div className="avatar-lg" aria-hidden="true">
            {t.name[0]}
          </div>
        </div>
        <div className="testimonial__main">
          <blockquote key={i} className="fade-in">
            “{before}
            <strong>{t.highlight}</strong>
            {after}”
          </blockquote>
          <div className="testimonial__foot">
            <div>
              <p className="testimonial__name">{t.name}</p>
              <p className="muted small">{t.place}</p>
            </div>
            <div className="btn-row">
              <button className="round-btn" onClick={() => go(-1)} aria-label="Previous testimonial">
                <ArrowLeft size={16} />
              </button>
              <button className="round-btn" onClick={() => go(1)} aria-label="Next testimonial">
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Team() {
  return (
    <section className="section">
      <div className="container">
        <div className="split-head">
          <div>
            <Eyebrow>Our Team</Eyebrow>
            <h2 className="h2">Meet Your Care Team</h2>
          </div>
          <p className="muted">
            Consultants and wig artisans who combine years of craft with genuine compassion — creating something that
            feels truly yours.
          </p>
        </div>
        <div className="team">
          {TEAM.map((m) => (
            <figure key={m.name} className="member">
              <img src={m.photo} alt={m.name} loading="lazy" />
              <figcaption>
                <strong>{m.name}</strong>
                <span>{m.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="cta" style={{ backgroundImage: 'url(/images/cta.jpg)' }}>
      <div className="cta__shade" />
      <div className="container cta__inner">
        <h2 className="display display--md">
          Take the First Step <em>Towards</em>
          <br />
          <em>Feeling Like You</em>
        </h2>
        <p>Our team is ready to listen, guide and craft something beautiful for you.</p>
        <Link to="/book" className="btn btn-gold">
          Get Started Today
        </Link>
        <div className="cta__corners">
          <Link to="/resources">Have a question? Read our care guide</Link>
          <Link to="/orders">Track your order</Link>
        </div>
      </div>
    </section>
  )
}
