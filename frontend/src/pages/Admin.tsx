import { useState, useMemo, useEffect, useCallback } from 'react'
import { fetchAuthSession } from 'aws-amplify/auth'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getAllQuestions, signupUser } from '../services/api'
import type { Question } from '../services/api'
import { awsConfig } from '../aws-config'
import './Admin.css'

const API_BASE_URL = awsConfig.API.REST.InterviewQuestionsAPI.endpoint

type Tab = 'overview' | 'questions' | 'users'

type QuestionForm = {
  question_text: string
  category: string
  difficulty: string
  reference_answer: string
}

const emptyForm: QuestionForm = {
  question_text: '',
  category: '',
  difficulty: 'Medium',
  reference_answer: '',
}

// ── Overview Tab ──────────────────────────────────────────────────
function OverviewTab({ questions }: { questions: Question[] }) {
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {}
    questions.forEach(q => {
      map[q.category] = (map[q.category] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [questions])

  const byDifficulty = useMemo(() => {
    const map: Record<string, number> = {}
    questions.forEach(q => {
      const d = q.difficulty.toLowerCase()
      map[d] = (map[d] || 0) + 1
    })
    return map
  }, [questions])

  const diffOrder = ['easy', 'medium', 'hard']

  return (
    <div className="admin-overview">
      <div className="overview-stat-grid">
        <div className="overview-stat-card total">
          <span className="overview-stat-value">{questions.length}</span>
          <span className="overview-stat-label">Total Questions</span>
        </div>
        <div className="overview-stat-card easy">
          <span className="overview-stat-value">{byDifficulty['easy'] || 0}</span>
          <span className="overview-stat-label">Easy</span>
        </div>
        <div className="overview-stat-card medium">
          <span className="overview-stat-value">{byDifficulty['medium'] || 0}</span>
          <span className="overview-stat-label">Medium</span>
        </div>
        <div className="overview-stat-card hard">
          <span className="overview-stat-value">{byDifficulty['hard'] || 0}</span>
          <span className="overview-stat-label">Hard</span>
        </div>
      </div>

      <div className="overview-sections">
        <div className="overview-panel">
          <h3 className="overview-panel-title">Questions by Category</h3>
          <div className="overview-bar-list">
            {byCategory.map(([cat, count]) => (
              <div key={cat} className="overview-bar-row">
                <span className="overview-bar-label">{cat}</span>
                <div className="overview-bar-track">
                  <div
                    className="overview-bar-fill"
                    style={{ width: `${(count / questions.length) * 100}%` }}
                  />
                </div>
                <span className="overview-bar-count">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="overview-panel">
          <h3 className="overview-panel-title">Difficulty Breakdown</h3>
          <div className="overview-difficulty-list">
            {diffOrder.map(d => {
              const count = byDifficulty[d] || 0
              const pct = questions.length ? Math.round((count / questions.length) * 100) : 0
              return (
                <div key={d} className={`overview-diff-row diff-${d}`}>
                  <span className="overview-diff-label">{d.charAt(0).toUpperCase() + d.slice(1)}</span>
                  <div className="overview-diff-track">
                    <div className="overview-diff-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="overview-diff-pct">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Questions Tab ─────────────────────────────────────────────────
function QuestionsTab({
  questions,
  loading,
  onRefresh,
  getAuthToken,
}: {
  questions: Question[]
  loading: boolean
  onRefresh: () => void
  getAuthToken: () => Promise<string | null>
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedDifficulty, setSelectedDifficulty] = useState('All')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [createForm, setCreateForm] = useState<QuestionForm>(emptyForm)

  const categories = useMemo(() => {
    const cats = new Set(questions.map(q => q.category))
    return ['All', ...Array.from(cats).sort()]
  }, [questions])

  const difficulties = useMemo(() => {
    const diffs = new Set(questions.map(q => q.difficulty.toLowerCase()))
    return ['All', ...Array.from(diffs)]
  }, [questions])

  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      const matchesSearch =
        q.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.category.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === 'All' || q.category === selectedCategory
      const matchesDifficulty =
        selectedDifficulty === 'All' ||
        q.difficulty.toLowerCase() === selectedDifficulty.toLowerCase()
      return matchesSearch && matchesCategory && matchesDifficulty
    })
  }, [questions, searchTerm, selectedCategory, selectedDifficulty])

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    try {
      const token = await getAuthToken()
      const response = await fetch(`${API_BASE_URL}questions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      if (!response.ok) {
        const err = await response.json()
        alert(`Error: ${err.message || 'Failed to create question'}`)
        return
      }
      onRefresh()
      setCreateForm(emptyForm)
      setShowCreateForm(false)
    } catch (error) {
      console.error('Error creating question:', error)
      alert('Failed to create question')
    }
  }

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingQuestion?.id) return
    try {
      const token = await getAuthToken()
      const response = await fetch(`${API_BASE_URL}questions/${editingQuestion.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: editingQuestion.question_text,
          category: editingQuestion.category,
          difficulty: editingQuestion.difficulty,
          reference_answer: editingQuestion.reference_answer,
        }),
      })
      if (!response.ok) {
        const err = await response.json()
        alert(`Error: ${err.message || 'Failed to update question'}`)
        return
      }
      onRefresh()
      setEditingQuestion(null)
    } catch (error) {
      console.error('Error updating question:', error)
      alert('Failed to update question')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this question? This cannot be undone.')) return
    try {
      const token = await getAuthToken()
      const response = await fetch(`${API_BASE_URL}questions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok || response.status === 204) {
        onRefresh()
      } else {
        alert('Failed to delete question')
      }
    } catch (error) {
      console.error('Error deleting question:', error)
      alert('Failed to delete question')
    }
  }

  const difficultyClass = (d: string) => `difficulty difficulty-${d.toLowerCase()}`
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

  return (
    <div className="admin-questions-tab">
      <div className="admin-tab-actions">
        <button
          className="admin-btn admin-btn-create"
          onClick={() => {
            setShowCreateForm(!showCreateForm)
            setEditingQuestion(null)
          }}
        >
          {showCreateForm ? 'Cancel' : '+ New Question'}
        </button>
        <button className="admin-btn admin-btn-ghost" onClick={onRefresh}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {showCreateForm && (
        <div className="admin-form-panel">
          <h2>Create Question</h2>
          <form onSubmit={handleCreate}>
            <div className="admin-form-group">
              <label>Question</label>
              <textarea
                rows={3}
                required
                placeholder="Enter the interview question..."
                value={createForm.question_text}
                onChange={e => setCreateForm({ ...createForm, question_text: e.target.value })}
              />
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Category</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AWS, System Design..."
                  value={createForm.category}
                  onChange={e => setCreateForm({ ...createForm, category: e.target.value })}
                />
              </div>
              <div className="admin-form-group">
                <label>Difficulty</label>
                <select
                  value={createForm.difficulty}
                  onChange={e => setCreateForm({ ...createForm, difficulty: e.target.value })}
                >
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </select>
              </div>
            </div>
            <div className="admin-form-group">
              <label>Reference Answer (optional)</label>
              <textarea
                rows={4}
                placeholder="Model answer..."
                value={createForm.reference_answer}
                onChange={e => setCreateForm({ ...createForm, reference_answer: e.target.value })}
              />
            </div>
            <button type="submit" className="admin-btn admin-btn-primary">Create</button>
          </form>
        </div>
      )}

      {editingQuestion && (
        <div className="admin-form-panel">
          <h2>Edit Question</h2>
          <form onSubmit={handleUpdate}>
            <div className="admin-form-group">
              <label>Question</label>
              <textarea
                rows={3}
                required
                value={editingQuestion.question_text}
                onChange={e => setEditingQuestion({ ...editingQuestion, question_text: e.target.value })}
              />
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Category</label>
                <input
                  type="text"
                  required
                  value={editingQuestion.category}
                  onChange={e => setEditingQuestion({ ...editingQuestion, category: e.target.value })}
                />
              </div>
              <div className="admin-form-group">
                <label>Difficulty</label>
                <select
                  value={editingQuestion.difficulty}
                  onChange={e => setEditingQuestion({ ...editingQuestion, difficulty: e.target.value })}
                >
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </select>
              </div>
            </div>
            <div className="admin-form-group">
              <label>Reference Answer</label>
              <textarea
                rows={4}
                value={editingQuestion.reference_answer}
                onChange={e => setEditingQuestion({ ...editingQuestion, reference_answer: e.target.value })}
              />
            </div>
            <div className="admin-form-buttons">
              <button type="submit" className="admin-btn admin-btn-primary">Save Changes</button>
              <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setEditingQuestion(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-filters">
        <input
          className="admin-search"
          type="text"
          placeholder="Search questions..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={selectedDifficulty} onChange={e => setSelectedDifficulty(e.target.value)}>
          {difficulties.map(d => <option key={d}>{capitalize(d)}</option>)}
        </select>
      </div>

      <p className="admin-results-count">{filteredQuestions.length} of {questions.length} questions</p>

      <div className="admin-questions-list">
        {filteredQuestions.length === 0 ? (
          <p className="admin-no-results">
            {questions.length === 0 ? 'No questions yet. Create one above.' : 'No questions match your filters.'}
          </p>
        ) : (
          filteredQuestions.map(q => (
            <div key={q.id} className="admin-question-card">
              <div className="admin-question-top">
                <span className={difficultyClass(q.difficulty)}>{capitalize(q.difficulty)}</span>
                <span className="admin-question-category">{q.category}</span>
              </div>
              <p className="admin-question-text">{q.question_text}</p>
              <div className="admin-question-actions">
                <button
                  className="admin-btn admin-btn-edit"
                  onClick={() => {
                    setEditingQuestion(q)
                    setShowCreateForm(false)
                  }}
                >
                  Edit
                </button>
                <button
                  className="admin-btn admin-btn-delete"
                  onClick={() => handleDelete(q.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Users Tab ─────────────────────────────────────────────────────
function UsersTab() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setStatus(null)
    try {
      const result = await signupUser(email, name)
      setStatus({ type: 'success', message: `User created. Temporary password sent to ${email}. Username: ${result.username}` })
      setEmail('')
      setName('')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create user'
      setStatus({ type: 'error', message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-users-tab">
      <div className="admin-users-header">
        <h2>Invite a New User</h2>
        <p>Creates a Cognito account and emails the user a temporary password.</p>
      </div>

      <div className="admin-form-panel">
        <form onSubmit={handleInvite}>
          <div className="admin-form-row">
            <div className="admin-form-group">
              <label>Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Jane Smith"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className="admin-form-group">
              <label>Email Address</label>
              <input
                type="email"
                required
                placeholder="jane@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create User & Send Invite'}
          </button>
        </form>

        {status && (
          <div className={`admin-status-msg admin-status-${status.type}`}>
            {status.message}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Root Admin Page ───────────────────────────────────────────────
function Admin() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<Question[]>([])
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { getAuthToken } = useAuth()

  const activeTab: Tab = (['overview', 'questions', 'users'].includes(searchParams.get('tab') ?? '')
    ? (searchParams.get('tab') as Tab)
    : 'overview')

  const setTab = (tab: Tab) => setSearchParams({ tab })

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true)
      const token = await getAuthToken()
      const data = await getAllQuestions(token)
      setQuestions(data)
    } catch (error) {
      console.error('Error loading questions:', error)
    } finally {
      setLoading(false)
    }
  }, [getAuthToken])

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const session = await fetchAuthSession()
        const groups = (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) || []
        if (groups.includes('Admin')) {
          setIsAdmin(true)
          await loadQuestions()
        } else {
          setIsAdmin(false)
          setLoading(false)
        }
      } catch (error) {
        console.error('Error checking admin access:', error)
        setIsAdmin(false)
        setLoading(false)
      }
    }
    checkAdminAccess()
  }, [loadQuestions])

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          <div className="admin-spinner" />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="admin-page">
        <div className="admin-access-denied">
          <h2>Access Denied</h2>
          <p>You need to be in the Admin group to access this page.</p>
          <button className="admin-btn admin-btn-ghost" onClick={() => navigate('/')}>Back to Home</button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-header-band">
        <div className="admin-header-inner">
          <div className="admin-header-left">
            <span className="admin-header-badge">Admin Console</span>
            <h1 className="admin-header-title">InterviewU Administration</h1>
          </div>
          <div className="admin-header-meta">
            <span>{questions.length} questions in platform</span>
          </div>
        </div>
      </div>

      <div className="admin-tab-bar">
        <div className="admin-tab-bar-inner">
          {(['overview', 'questions', 'users'] as Tab[]).map(tab => (
            <button
              key={tab}
              className={`admin-tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-content">
        {activeTab === 'overview' && <OverviewTab questions={questions} />}
        {activeTab === 'questions' && (
          <QuestionsTab
            questions={questions}
            loading={loading}
            onRefresh={loadQuestions}
            getAuthToken={getAuthToken}
          />
        )}
        {activeTab === 'users' && <UsersTab />}
      </div>
    </div>
  )
}

export default Admin