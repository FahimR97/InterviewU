import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './Home.css'

const features = [
  {
    tag: 'Questions',
    icon: '📚',
    title: 'Carefully curated interview questions',
    description: 'Hundreds of questions across system design, DevOps, cloud, algorithms, networking and Linux — filtered by difficulty.',
  },
  {
    tag: 'AI Feedback',
    icon: '🤖',
    title: 'Know exactly where you went wrong',
    description: 'Every answer gets scored out of 100 with specific strengths, gaps, and suggestions — not generic tips.',
  },
  {
    tag: 'Career Focus',
    icon: '🎯',
    title: 'Built for engineers moving up',
    description: 'Targeted at SDE, DevOps, and cloud roles. The questions reflect what hiring managers actually test.',
  },
]

const steps = [
  { number: '01', title: 'Create your account', description: 'Sign up in seconds. No credit card required.' },
  { number: '02', title: 'Pick your focus area', description: 'Filter by role, category, or difficulty level.' },
  { number: '03', title: 'Practice and improve', description: 'Answer questions, get scored feedback, and track your progress over time.' },
]

function useCountUp(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number | null = null
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(ease * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, start])
  return count
}

export default function Home() {
  const cardRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const [statsVisible, setStatsVisible] = useState(false)
  const questionCount = useCountUp(500, 1600, statsVisible)

  // Scroll reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) entry.target.classList.add('visible')
        })
      },
      { threshold: 0.1 }
    )
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  // Stats count-up trigger
  useEffect(() => {
    const el = document.querySelector('.hero-stats')
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true) },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // 3D card tilt on mouse move
  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    card.style.transform = `perspective(700px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateY(-6px) scale(1.02)`
  }

  const handleCardMouseLeave = () => {
    const card = cardRef.current
    if (!card) return
    card.style.transform = ''
  }

  return (
    <div className="home">

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="hero" ref={heroRef}>
        <div className="hero-bg-orb orb-1" />
        <div className="hero-bg-orb orb-2" />
        <div className="hero-bg-orb orb-3" />

        <div className="hero-inner">
          <div className="hero-text">

            <div className="hero-status-pill">
              <span className="status-dot" />
              AI-Powered Interview Prep
            </div>

            <h1 className="hero-title">
              Ace your next<br />
              <span className="gradient-text">Technical Interview.</span>
            </h1>

            <p className="hero-subtitle">
              Practice real interview questions with instant AI feedback.
              Pinpoint your weaknesses before the interview does it for you.
            </p>

            <div className="hero-actions">
              <Link to="/signup" className="btn-cta">
                Get Started — it&apos;s free
                <span className="btn-arrow">→</span>
              </Link>
              <Link to="/login" className="btn-ghost">Sign in</Link>
            </div>

            <div className="hero-stats">
              <div className="stat">
                <span className="stat-value">{statsVisible ? `${questionCount}+` : '0'}</span>
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
            <div className="card-glow" />

            <div className="mock-card-wrapper">
              {/* Floating micro-badges — positioned relative to the card wrapper */}
              <div className="float-badge float-badge-1">
                <span className="float-badge-dot" />
                Marcus is evaluating…
              </div>
              <div className="float-badge float-badge-2">
                ✅ Score: 87/100
              </div>

            <div
              className="mock-card"
              ref={cardRef}
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
            >
              <div className="mock-card-inner">
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
            </div>{/* end mock-card-wrapper */}
          </div>{/* end hero-visual */}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────── */}
      <section className="features">
        <div className="section-inner">
          <p className="section-eyebrow reveal">What you get</p>
          <h2 className="section-heading reveal">Everything you need to prepare properly</h2>
          <div className="features-grid">
            {features.map((f, i) => (
              <div key={f.tag} className="feature-card reveal" style={{ transitionDelay: `${i * 0.12}s` }}>
                <div className="feature-icon">{f.icon}</div>
                <span className="feature-tag">{f.tag}</span>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Meet Marcus ──────────────────────────────── */}
      <section className="marcus-section">
        <div className="section-inner marcus-inner">
          <div className="marcus-text">
            <p className="section-eyebrow reveal">AI Interview Coach</p>
            <h2 className="marcus-heading reveal">Meet Marcus.</h2>
            <p className="marcus-desc reveal">
              Marcus is your personal AI interviewer — powered by Claude. He evaluates every answer,
              scores it out of 100, and gives you honest, specific feedback that helps you actually
              improve. No generic tips. No vague encouragement.
            </p>
            <div className="marcus-traits">
              <div className="marcus-trait reveal">
                <span className="trait-icon">🎯</span>
                <div>
                  <strong>Scores every answer out of 100</strong>
                  <p>Precise scoring with clear reasoning — know exactly where you stand.</p>
                </div>
              </div>
              <div className="marcus-trait reveal" style={{ transitionDelay: '0.1s' }}>
                <span className="trait-icon">💡</span>
                <div>
                  <strong>Identifies your specific gaps</strong>
                  <p>Strengths, improvements, and targeted suggestions for every response.</p>
                </div>
              </div>
              <div className="marcus-trait reveal" style={{ transitionDelay: '0.2s' }}>
                <span className="trait-icon">📈</span>
                <div>
                  <strong>Tracks your progress over time</strong>
                  <p>Analytics dashboard shows your score trajectory and weak areas.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="marcus-visual reveal">
            <div className="marcus-avatar-ring">
              <div className="marcus-avatar">🤖</div>
            </div>
            <div className="marcus-chat">
              <div className="chat-bubble chat-question">
                <span className="chat-label">You</span>
                I would use a message broker like Kafka with partitioning to handle the throughput…
              </div>
              <div className="chat-bubble chat-marcus">
                <span className="chat-label marcus-label">Marcus</span>
                Good instinct on Kafka. Your partitioning strategy is sound, but you haven't addressed
                consumer group lag or at-least-once delivery guarantees under failure. Score: <strong>71/100</strong>.
              </div>
              <div className="chat-score-row">
                <div className="chat-score-bar">
                  <div className="chat-score-fill" style={{ width: '71%' }} />
                </div>
                <span className="chat-score-num">71</span>
              </div>
            </div>
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
          <Link to="/signup" className="btn-cta btn-cta-dark reveal">Get Started Free →</Link>
        </div>
      </section>

    </div>
  )
}