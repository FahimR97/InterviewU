import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import './Home.css'

const features = [
  {
    tag: 'Questions',
    title: 'Carefully curated interview questions',
    description: 'Hundreds of questions across categories — system design, DevOps, cloud, algorithms — filtered by difficulty.',
  },
  {
    tag: 'Bespoke Feedback',
    title: 'Know exactly where you went wrong',
    description: 'Every answer gets scored out of 100 with specific strengths, gaps, and suggestions — not generic tips.',
  },
  {
    tag: 'Career Focus',
    title: 'Built for engineers moving up',
    description: 'Targeted at SDE, DevOps, and cloud roles. The questions reflect what hiring managers actually test.',
  },
]

const steps = [
  { number: '01', title: 'Create your account', description: 'Sign up in seconds. No credit card.' },
  { number: '02', title: 'Pick your focus area', description: 'Filter by role, category, or difficulty level.' },
  { number: '03', title: 'Practice and improve', description: 'Answer questions, get your feedback, and track your progress.' },
]

export default function Home() {
  // Scroll reveal — elements with .reveal fade in when they enter the viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.12 }
    )
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="home">

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-bg-orb orb-1" />
        <div className="hero-bg-orb orb-2" />
        <div className="hero-bg-orb orb-3" />

        <div className="hero-inner">
          <div className="hero-text">
            <span className="hero-eyebrow">AI-Powered Interview Prep</span>
            <h1 className="hero-title">
              Ace your next<br />
              <span className="gradient-text">Technical Interview.</span>
            </h1>
            <p className="hero-subtitle">
              Practice real interview questions with instant AI feedback.
              Pinpoint your weaknesses before the interview does it for you.
            </p>
            <div className="hero-actions">
              <Link to="/signup" className="btn-cta">Get Started — it&apos;s free</Link>
            </div>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-value">500+</span>
                <span className="stat-label">Questions</span>
              </div>
              <div className="stat-divider" />
              <div className="stat">
                <span className="stat-value">AI</span>
                <span className="stat-label">Feedback</span>
              </div>
              <div className="stat-divider" />
              <div className="stat">
                <span className="stat-value">Free</span>
                <span className="stat-label">To use</span>
              </div>
            </div>
          </div>

          {/* Product preview card */}
          <div className="hero-visual">
            <div className="mock-card">
              <div className="mock-card-header">
                <span className="mock-category">System Design</span>
                <span className="mock-badge hard">Hard</span>
              </div>
              <p className="mock-question">
                Design a distributed message queue that guarantees at-least-once delivery at 1M messages/sec.
              </p>
              <div className="mock-divider" />
              <div className="mock-score-row">
                <span className="mock-score-label">Your Score</span>
                <span className="mock-score-value">87 / 100</span>
              </div>
              <div className="mock-progress-track">
                <div className="mock-progress-fill" style={{ width: '87%' }} />
              </div>
              <div className="mock-feedback">
                <div className="mock-feedback-item correct">
                  <span className="mock-dot correct-dot" />
                  Correctly identified horizontal scaling approach
                </div>
                <div className="mock-feedback-item improve">
                  <span className="mock-dot improve-dot" />
                  Cache eviction strategy needs more detail
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────── */}
      <section className="features">
        <div className="section-inner">
          <p className="section-eyebrow reveal">What you get</p>
          <h2 className="section-heading reveal">Everything you need to prepare properly</h2>
          <div className="features-grid">
            {features.map((f, i) => (
              <div key={f.tag} className="feature-card reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
                <span className="feature-tag">{f.tag}</span>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────── */}
      <section className="how-it-works">
        <div className="section-inner">
          <p className="section-eyebrow reveal">Simple process</p>
          <h2 className="section-heading reveal">How it works</h2>
          <div className="steps">
            {steps.map((step, i) => (
              <div key={step.number} className="step reveal" style={{ transitionDelay: `${i * 0.12}s` }}>
                <span className="step-number">{step.number}</span>
                <h3 className="step-title">{step.title}</h3>
                <p className="step-desc">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────── */}
      <section className="cta-banner">
        <div className="section-inner cta-inner">
          <h2 className="cta-heading reveal">Ready to start preparing?</h2>
          <p className="cta-sub reveal">Join engineers using InterviewU to land their next role.</p>
          <Link to="/signup" className="btn-cta btn-cta-dark reveal">Get Started Free</Link>
        </div>
      </section>

    </div>
  )
}
