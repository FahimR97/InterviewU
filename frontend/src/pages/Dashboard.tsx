import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { getAnalytics, getSettings, saveSettings } from '../services/api'
import type { AnalyticsResponse, AnalyticsTimeEntry } from '../services/api'
import './Dashboard.css'

const CATEGORY_LABELS: Record<string, string> = {
  // Current categories
  behavioural: 'Behavioural',
  behavioral: 'Behavioural',
  automation: 'Automation',
  system_design: 'System Design',
  networking: 'Networking',
  linux: 'Linux & Bash',
  coding: 'Coding',
  operational_excellence: 'Operational Excellence',
  // Legacy category names — fold into their current equivalents
  leadership_principle: 'Behavioural',
  leadership: 'Behavioural',
  soft_skills: 'Behavioural',
  competency: 'Behavioural',
  programming: 'Coding',
  algorithms: 'Coding',
  architecture: 'System Design',
}

function fmtCategory(raw: string): string {
  return CATEGORY_LABELS[raw.toLowerCase()] ?? raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const CATEGORY_COLOURS = [
  '#0d9488', '#6366f1', '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#ef4444',
]

function MetricCard({ icon, label, value, accent }: { icon: string; label: string; value: string | number; accent: string }) {
  return (
    <div className="metric-card" style={{ borderLeft: `4px solid ${accent}` }}>
      <span className="metric-icon" style={{ color: accent }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <p className="metric-label">{label}</p>
        <p className="metric-value">{value}</p>
      </div>
    </div>
  )
}

function InterviewCountdown() {
  const { getAuthToken } = useAuth()
  // Seed from localStorage immediately so there's no flash on load
  const [targetDate, setTargetDate] = useState<string>(() => localStorage.getItem('interviewDate') || '')
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState(targetDate)
  const [saving, setSaving] = useState(false)

  const [now] = useState(() => Date.now())

  // Load from API on mount — overwrites localStorage with server value
  useEffect(() => {
    getAuthToken().then(token =>
      getSettings(token).then(s => {
        if (s.interview_date) {
          setTargetDate(s.interview_date)
          setInputVal(s.interview_date)
          localStorage.setItem('interviewDate', s.interview_date)
        }
      }).catch(() => { /* use localStorage fallback silently */ })
    ).catch(() => {})
  }, [getAuthToken])

  const daysLeft = targetDate
    ? Math.ceil((new Date(targetDate).getTime() - now) / 86400000)
    : null

  const save = async () => {
    setSaving(true)
    localStorage.setItem('interviewDate', inputVal)
    setTargetDate(inputVal)
    setEditing(false)
    try {
      const token = await getAuthToken()
      await saveSettings({ interview_date: inputVal }, token)
    } catch {
      // saved locally — will sync next session when API is available
    } finally {
      setSaving(false)
    }
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
          <button className="btn btn-small btn-primary" onClick={save} disabled={!inputVal || saving}>
            {saving ? 'Saving…' : 'Save'}
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

interface HeatTooltip {
  x: number
  y: number
  entry: AnalyticsTimeEntry
}

function ActivityHeatmap({ data }: { data: AnalyticsTimeEntry[] }) {
  const CELL = 14
  const GAP = 4
  const STRIDE = CELL + GAP
  const [tooltip, setTooltip] = useState<HeatTooltip | null>(null)

  const lookup = useMemo(() => {
    const map: Record<string, AnalyticsTimeEntry> = {}
    data.forEach(d => { map[d.date] = d })
    return map
  }, [data])

  const weeks = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(today)
    start.setDate(start.getDate() - 52 * 7)
    start.setDate(start.getDate() - start.getDay())

    const result: Array<Array<Date | null>> = []
    const cur = new Date(start)
    while (cur <= today) {
      const week: Array<Date | null> = []
      for (let d = 0; d < 7; d++) {
        week.push(new Date(cur) <= today ? new Date(cur) : null)
        cur.setDate(cur.getDate() + 1)
      }
      result.push(week)
    }
    return result
  }, [])

  const months = useMemo(() => {
    const seen = new Set<string>()
    return weeks.reduce<Array<{ label: string; wIdx: number }>>((acc, week, wIdx) => {
      const first = week.find(d => d !== null)
      if (!first) return acc
      const label = first.toLocaleDateString('en-US', { month: 'short' })
      if (!seen.has(label)) { seen.add(label); acc.push({ label, wIdx }) }
      return acc
    }, [])
  }, [weeks])

  const maxAttempts = useMemo(() => Math.max(1, ...data.map(d => d.attempts)), [data])
  const toISO = (d: Date) => d.toISOString().split('T')[0]

  const cellBg = (iso: string) => {
    const n = lookup[iso]?.attempts || 0
    if (!n) return undefined
    const r = n / maxAttempts
    if (r < 0.25) return '#99f6e4'
    if (r < 0.5)  return '#2dd4bf'
    if (r < 0.75) return '#14b8a6'
    return '#0d9488'
  }

  const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']
  const totalAnswered = data.reduce((s, d) => s + d.attempts, 0)

  return (
    <div className="chart-card chart-card-full">
      <div className="heatmap-top">
        <h3>Activity</h3>
        <span className="heatmap-summary">{totalAnswered} question{totalAnswered !== 1 ? 's' : ''} answered in the last 12 months</span>
      </div>
      <div className="heatmap-scroll">
        <div className="heatmap-month-row">
          <div className="heatmap-spacer" />
          <div className="heatmap-months-inner" style={{ width: weeks.length * STRIDE }}>
            {months.map(m => (
              <span key={m.label} className="heatmap-month-label" style={{ left: m.wIdx * STRIDE }}>{m.label}</span>
            ))}
          </div>
        </div>
        <div className="heatmap-body">
          <div className="heatmap-day-col">
            {DAY_LABELS.map((label, i) => (
              <span key={i} className="heatmap-day-label" style={{ height: CELL, lineHeight: `${CELL}px` }}>{label}</span>
            ))}
          </div>
          <div className="heatmap-grid" style={{ gridTemplateRows: `repeat(7, ${CELL}px)`, gridAutoColumns: CELL }}>
            {weeks.flatMap((week, wIdx) =>
              week.map((day, dIdx) => {
                if (!day) return <div key={`null-${wIdx}-${dIdx}`} className="heatmap-cell heatmap-cell-null" />
                const iso = toISO(day)
                const entry = lookup[iso]
                const bg = cellBg(iso)
                return (
                  <div
                    key={iso}
                    className={`heatmap-cell${!entry ? ' heatmap-cell-zero' : ''}`}
                    style={bg ? { background: bg } : undefined}
                    onMouseEnter={e => entry && setTooltip({ x: e.clientX, y: e.clientY, entry })}
                    onMouseLeave={() => setTooltip(null)}
                  />
                )
              })
            )}
          </div>
        </div>
        <div className="heatmap-legend">
          <span>Less</span>
          {['var(--bg-tertiary)', '#99f6e4', '#2dd4bf', '#14b8a6', '#0d9488'].map((c, i) => (
            <div key={i} className="heatmap-cell" style={{ background: c }} />
          ))}
          <span>More</span>
        </div>
      </div>

      {tooltip && (
        <div className="heatmap-tooltip" style={{
          top: tooltip.y - 12,
          left: tooltip.x + 14 + 220 > window.innerWidth ? tooltip.x - 234 : tooltip.x + 14,
        }}>
          <div className="heatmap-tooltip-date">
            {new Date(tooltip.entry.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <div className="heatmap-tooltip-count">
            {tooltip.entry.attempts} question{tooltip.entry.attempts !== 1 ? 's' : ''} &middot; avg {tooltip.entry.avg_score}/100
          </div>
          {tooltip.entry.categories && Object.keys(tooltip.entry.categories).length > 0 && (
            <div className="heatmap-tooltip-cats">
              {Object.entries(tooltip.entry.categories)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => (
                  <span key={cat} className="heatmap-tooltip-cat">
                    {fmtCategory(cat)} <strong>{count}</strong>
                  </span>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { user, userName, getAuthToken } = useAuth()
  const { theme } = useTheme()
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const displayName = userName?.split(' ')[0] ?? null

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

  const tooltipStyle = {
    background: theme === 'dark' ? '#1e293b' : '#ffffff',
    border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
    borderRadius: 8,
    color: theme === 'dark' ? '#f1f5f9' : '#111827',
  }
  const labelStyle = { color: theme === 'dark' ? '#94a3b8' : '#64748b' }

  const hasTimeSeries = analytics && analytics.scores_over_time.length >= 2

  return (
    <div className="dashboard">
      <div className="dashboard-hero">
        <div>
          <h1 className="dashboard-greeting">
            {displayName ? `Welcome back, ${displayName}` : 'Welcome back'}
          </h1>
          <p className="dashboard-sub">Let's get to work.</p>
        </div>
        <InterviewCountdown />
      </div>

      {loading && (
        <div className="dashboard-loading">
          <div className="loading-spinner" />
          <p>Loading your analytics…</p>
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
          {/* Metric cards */}
          <div className="metric-row">
            <MetricCard icon="📝" label="Questions Answered" value={analytics.total_attempts} accent="#0d9488" />
            <MetricCard
              icon="🎯"
              label="Average Score"
              value={analytics.avg_score !== null ? `${Math.round(analytics.avg_score)}/100` : '—'}
              accent="#6366f1"
            />
            <MetricCard
              icon="🏆"
              label="Best Category"
              value={analytics.by_category.length > 0
                ? fmtCategory(analytics.by_category.reduce((a, b) => a.avg_score > b.avg_score ? a : b).category)
                : '—'}
              accent="#10b981"
            />
            <MetricCard
              icon="⚡"
              label="Focus Area"
              value={analytics.weak_areas.length > 0 ? fmtCategory(analytics.weak_areas[0]) : 'All good'}
              accent="#f59e0b"
            />
          </div>

          {/* Recommendation */}
          <div className="recommendation-card">
            <div className="rec-icon">💡</div>
            <div>
              <h3>Study Recommendation</h3>
              <p>{analytics.recommendation}</p>
            </div>
          </div>

          {/* Charts grid: score over time + score by category */}
          <div className={`charts-grid${hasTimeSeries ? '' : ' charts-grid-single'}`}>
            {hasTimeSeries && (
              <div className="chart-card">
                <h3>Score Over Time</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={analytics.scores_over_time} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#0d9488" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: theme === 'dark' ? '#64748b' : '#94a3b8' }}
                      tickFormatter={d => d.slice(5)}
                    />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: theme === 'dark' ? '#64748b' : '#94a3b8' }} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} formatter={(v: unknown) => [`${v}/100`, 'Avg Score']} />
                    <Area
                      type="monotone"
                      dataKey="avg_score"
                      stroke="#0d9488"
                      strokeWidth={2.5}
                      fill="url(#scoreGrad)"
                      dot={{ fill: '#0d9488', r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                      name="Avg Score"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="chart-card">
              <h3>Score by Category</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={analytics.by_category}
                  layout="vertical"
                  margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: theme === 'dark' ? '#64748b' : '#94a3b8' }} />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={120}
                    tick={{ fontSize: 11, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }}
                    tickFormatter={fmtCategory}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={labelStyle}
                    formatter={(v: unknown) => [`${v}/100`, 'Avg Score']}
                    labelFormatter={(label: unknown) => fmtCategory(String(label))}
                  />
                  <Bar dataKey="avg_score" name="Avg Score" radius={[0, 6, 6, 0]}>
                    {analytics.by_category.map((_, idx) => (
                      <Cell key={idx} fill={CATEGORY_COLOURS[idx % CATEGORY_COLOURS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Activity heatmap */}
          <ActivityHeatmap data={analytics.scores_over_time} />

          <div className="dashboard-cta">
            <Link to="/questions" className="btn btn-primary">Continue Practising</Link>
          </div>
        </>
      )}
    </div>
  )
}