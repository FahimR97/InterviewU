import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { getAnalytics } from '../services/api'
import type { AnalyticsResponse } from '../services/api'
import './Dashboard.css'

const CATEGORY_COLOURS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444',
]

const DIFFICULTY_COLOURS: Record<string, string> = {
  easy: '#10b981',
  medium: '#f59e0b',
  hard: '#ef4444',
}

function ScoreRing({ score }: { score: number }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const colour = score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <svg width="130" height="130" className="score-ring">
      <circle cx="65" cy="65" r={radius} className="score-ring-track" />
      <circle
        cx="65"
        cy="65"
        r={radius}
        className="score-ring-fill"
        stroke={colour}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
      <text x="65" y="62" textAnchor="middle" className="score-ring-value">
        {score}
      </text>
      <text x="65" y="78" textAnchor="middle" className="score-ring-label">
        / 100
      </text>
    </svg>
  )
}

function InterviewCountdown() {
  const [targetDate, setTargetDate] = useState<string>(() => localStorage.getItem('interviewDate') || '')
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState(targetDate)

  const daysLeft = targetDate
    ? Math.ceil((new Date(targetDate).getTime() - Date.now()) / 86400000)
    : null

  const save = () => {
    localStorage.setItem('interviewDate', inputVal)
    setTargetDate(inputVal)
    setEditing(false)
  }

  return (
    <div className="countdown-card">
      <div className="countdown-icon">📅</div>
      {!targetDate || editing ? (
        <div className="countdown-set">
          <p>Set your interview date</p>
          <input
            type="date"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            className="date-input"
          />
          <button className="btn btn-small btn-primary" onClick={save} disabled={!inputVal}>
            Save
          </button>
          {editing && (
            <button className="btn btn-small" onClick={() => setEditing(false)}>
              Cancel
            </button>
          )}
        </div>
      ) : daysLeft !== null && daysLeft < 0 ? (
        <div className="countdown-set">
          <p className="countdown-past">Interview date has passed</p>
          <button className="btn btn-small" onClick={() => setEditing(true)}>Update date</button>
        </div>
      ) : (
        <div className="countdown-display">
          <span className="countdown-number">{daysLeft}</span>
          <span className="countdown-unit">days to go</span>
          <span className="countdown-date">{new Date(targetDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <button className="btn btn-small" onClick={() => setEditing(true)}>Change</button>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { user, userName, getAuthToken } = useAuth()
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const greeting = userName
    ? `Hello ${userName.split(' ')[0]}, let's get to work`
    : "Welcome back, let's get to work"

  useEffect(() => {
    if (!user) return
    getAuthToken()
      .then(token => getAnalytics(token))
      .then(data => setAnalytics(data))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [user, getAuthToken])

  if (!user) {
    return (
      <div className="dashboard-empty">
        <p>Please <Link to="/login">sign in</Link> to view your dashboard.</p>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard-hero">
        <div>
          <h1 className="dashboard-greeting">{greeting}</h1>
          <p className="dashboard-sub">Track your progress and focus on what matters most.</p>
        </div>
        <InterviewCountdown />
      </div>

      {loading && (
        <div className="dashboard-loading">
          <div className="loading-spinner" />
          <p>Loading your analytics...</p>
        </div>
      )}

      {error && (
        <div className="error-box">
          <p>Failed to load analytics: {error}</p>
        </div>
      )}

      {!loading && !error && analytics && analytics.total_attempts === 0 && (
        <div className="dashboard-empty-state">
          <div className="empty-icon">📊</div>
          <h2>No data yet</h2>
          <p>Start practising questions and your analytics will appear here.</p>
          <Link to="/questions" className="btn btn-primary">Go to Question Bank</Link>
        </div>
      )}

      {!loading && !error && analytics && analytics.total_attempts > 0 && (
        <>
          {/* Stat cards */}
          <div className="stat-cards">
            <div className="stat-card">
              <span className="stat-label">Total Attempts</span>
              <span className="stat-value">{analytics.total_attempts}</span>
            </div>
            <div className="stat-card stat-card-center">
              <span className="stat-label">Average Score</span>
              {analytics.avg_score !== null && <ScoreRing score={Math.round(analytics.avg_score)} />}
            </div>
            <div className="stat-card">
              <span className="stat-label">Best Category</span>
              <span className="stat-value stat-value-sm">
                {analytics.by_category.length > 0
                  ? analytics.by_category.reduce((a, b) => a.avg_score > b.avg_score ? a : b).category
                  : '—'}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Weak Areas</span>
              <span className="stat-value stat-value-sm">
                {analytics.weak_areas.length > 0 ? analytics.weak_areas.join(', ') : 'None — great work!'}
              </span>
            </div>
          </div>

          {/* Recommendation */}
          <div className="recommendation-card">
            <div className="rec-icon">💡</div>
            <div>
              <h3>Study Recommendation</h3>
              <p>{analytics.recommendation}</p>
            </div>
          </div>

          {/* Charts row */}
          <div className="charts-row">
            {/* Score over time */}
            <div className="chart-card chart-card-wide">
              <h3>Score Over Time</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={analytics.scores_over_time} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8 }}
                    labelStyle={{ color: 'var(--text-dark)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg_score"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ fill: '#6366f1', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Avg Score"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Category pie */}
            <div className="chart-card">
              <h3>Score by Category</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={analytics.by_category}
                    dataKey="avg_score"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ category, avg_score }) => `${category} ${avg_score}`}
                    labelLine={false}
                  >
                    {analytics.by_category.map((_, idx) => (
                      <Cell key={idx} fill={CATEGORY_COLOURS[idx % CATEGORY_COLOURS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8 }}
                    formatter={(value: number) => [`${value}/100`, 'Avg Score']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Difficulty bar chart */}
          <div className="chart-card chart-card-full">
            <h3>Score by Difficulty</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analytics.by_difficulty} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="difficulty" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8 }}
                  formatter={(value: number) => [`${value}/100`, 'Avg Score']}
                />
                <Legend wrapperStyle={{ color: 'var(--text-muted)', fontSize: 12 }} />
                <Bar dataKey="avg_score" name="Avg Score" radius={[6, 6, 0, 0]}>
                  {analytics.by_difficulty.map((entry, idx) => (
                    <Cell key={idx} fill={DIFFICULTY_COLOURS[entry.difficulty.toLowerCase()] || '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="dashboard-cta">
            <Link to="/questions" className="btn btn-primary">Continue Practising</Link>
          </div>
        </>
      )}
    </div>
  )
}