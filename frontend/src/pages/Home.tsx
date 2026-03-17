import { Link } from 'react-router-dom'
import './Home.css'

const features = [
  {
    tag: 'Questions',
    title: 'Curated by real interviews',
    description: 'Filter by category and difficulty. Focus on what actually gets asked.',
  },
  {
    tag: 'Feedback',
    title: 'AI feedback on every answer',
    description: 'Get a score, detailed strengths, and specific things to fix — instantly.',
  },
  {
    tag: 'Progress',
    title: 'Know where you stand',
    description: 'See patterns in your answers. Improve before the interview, not after.',
  },
]

const steps = [
  { number: '01', title: 'Sign up', description: 'Create your account in seconds.' },
  { number: '02', title: 'Pick a question', description: 'Filter by role, category, or difficulty.' },
  { number: '03', title: 'Get feedback', description: 'Submit your answer and get AI feedback instantly.' },
]

export default function Home() {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <p className="hero-eyebrow">AI-Powered Interview Prep</p>
          <h1 className="hero-title">
            Ace your next<br />
            <span className="gradient-text">technical interview</span>
          </h1>
          <p className="hero-subtitle">
            Practice real questions with AI-powered feedback.
            Know your strengths. Fix your gaps.
          </p>
          <div className="hero-actions">
            <Link to="/signup" className="btn-primary">Get Started</Link>
            <Link to="/login" className="btn-ghost">Login</Link>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="section-inner">
          <h2 className="section-heading">Everything you need to prepare</h2>
          <div className="features-grid">
            {features.map(f => (
              <div key={f.tag} className="feature-card">
                <span className="feature-tag">{f.tag}</span>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="how-it-works">
        <div className="section-inner">
          <h2 className="section-heading">How it works</h2>
          <div className="steps">
            {steps.map(step => (
              <div key={step.number} className="step">
                <span className="step-number">{step.number}</span>
                <h3 className="step-title">{step.title}</h3>
                <p className="step-desc">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
