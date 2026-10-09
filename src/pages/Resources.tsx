import { Check, ChevronDown, Play, X } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Eyebrow, Page } from '../components/Layout'
import { FAQS, VIDEOS, WIG_DONTS, WIG_DOS, type Video } from '../content/site'

export default function Resources() {
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' })
  }, [hash])

  return (
    <Page overlayNav>
      <section className="banner" style={{ backgroundImage: 'url(/images/resources.jpg)' }}>
        <div className="banner__shade" />
        <div className="container banner__inner">
          <Eyebrow light>Resources</Eyebrow>
          <h1 className="display display--md">
            Caring for Your Wig, <em>and</em>
            <br />
            <em>for Yourself</em>
          </h1>
          <p>Simple guidance to keep your wig beautiful and comfortable — for months to come.</p>
          <div className="btn-row">
            <a href="#guide" className="btn btn-light">
              Do's & Don'ts
            </a>
            <a href="#videos" className="btn btn-glass">
              Watch the videos
            </a>
          </div>
        </div>
      </section>

      <section className="section" id="guide">
        <div className="container">
          <div className="split-head">
            <div>
              <Eyebrow>Wig Care Guide</Eyebrow>
              <h2 className="h2">
                Do's <em>&</em> Don'ts
              </h2>
            </div>
            <p className="muted">
              A well-cared-for human-hair wig can last a year or more. These habits make the biggest difference.
            </p>
          </div>
          <div className="dos">
            <div className="dos__col">
              <h3 className="dos__title dos__title--do">
                <Check size={18} /> Do
              </h3>
              {WIG_DOS.map((d) => (
                <div key={d.title} className="dos__item">
                  <span className="dos__mark dos__mark--do">
                    <Check size={14} />
                  </span>
                  <div>
                    <h4>{d.title}</h4>
                    <p>{d.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="dos__col">
              <h3 className="dos__title dos__title--dont">
                <X size={18} /> Don't
              </h3>
              {WIG_DONTS.map((d) => (
                <div key={d.title} className="dos__item">
                  <span className="dos__mark dos__mark--dont">
                    <X size={14} />
                  </span>
                  <div>
                    <h4>{d.title}</h4>
                    <p>{d.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section section--cream" id="videos">
        <div className="container">
          <div className="split-head">
            <div>
              <Eyebrow>Video Guides</Eyebrow>
              <h2 className="h2">
                How to Wear <em>&</em>
                <br />
                <em>Care for Your Wig</em>
              </h2>
            </div>
            <p className="muted">Short, gentle walkthroughs you can pause, replay and come back to anytime.</p>
          </div>
          <div className="videos">
            {VIDEOS.map((v) => (
              <VideoCard key={v.title} video={v} />
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container faq">
          <div>
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="h2">
              Questions <em>We Often</em>
              <br />
              <em>Hear</em>
            </h2>
            <p className="muted">Can't find what you're looking for? Book a consultation — we're happy to help.</p>
            <Link to="/book/consultation" className="btn btn-dark">
              Book a Consultation
            </Link>
          </div>
          <div className="faq__list">
            {FAQS.map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q} <ChevronDown size={18} />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </Page>
  )
}

function VideoCard({ video }: { video: Video }) {
  return (
    <article className="video">
      <div className="video__frame">
        {video.youtubeId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}`}
            title={video.title}
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="video__soon">
            <span className="video__play">
              <Play size={20} />
            </span>
            <small>Video coming soon</small>
          </div>
        )}
      </div>
      <div className="video__body">
        <h3>{video.title}</h3>
        <p className="muted small">{video.description}</p>
        <span className="small video__dur">{video.duration}</span>
      </div>
    </article>
  )
}
