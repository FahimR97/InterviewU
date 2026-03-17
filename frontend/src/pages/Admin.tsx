import { useState, useMemo, useEffect } from 'react'
import { fetchAuthSession } from 'aws-amplify/auth'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getAllQuestions } from '../services/api'
import type { Question } from '../services/api'
import { awsConfig } from '../aws-config'
import './Questions.css'
import './Admin.css'

const API_BASE_URL = awsConfig.API.REST.InterviewQuestionsAPI.endpoint

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

function Admin() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<Question[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedDifficulty, setSelectedDifficulty] = useState('All')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [createForm, setCreateForm] = useState<QuestionForm>(emptyForm)
  const navigate = useNavigate()
  const { getAuthToken } = useAuth()

  useEffect(() => {
    checkAdminAccess()
  }, [])

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

  const loadQuestions = async () => {
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
  }

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

  const handleCreate = async (e: React.FormEvent) => {
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
      await loadQuestions()
      setCreateForm(emptyForm)
      setShowCreateForm(false)
    } catch (error) {
      console.error('Error creating question:', error)
      alert('Failed to create question')
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
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
      await loadQuestions()
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
        await loadQuestions()
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

  if (loading) {
    return (
      <div className="questions-container">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="questions-container">
        <div className="error-box">
          <h2>Access Denied</h2>
          <p>You need to be in the Admin group to access this page.</p>
          <button className="btn" onClick={() => navigate('/')}>Back to Home</button>
        </div>
      </div>
    )
  }

  return (
    <div className="questions-container">
      <header className="questions-header">
        <h1>Admin Dashboard</h1>
        <p>Manage interview questions</p>
        <button className="btn-small" onClick={() => navigate('/')}>Back to Home</button>
      </header>

      <div className="admin-actions">
        <button
          className="btn-small btn-create"
          onClick={() => {
            setShowCreateForm(!showCreateForm)
            setEditingQuestion(null)
          }}
        >
          {showCreateForm ? 'Cancel' : '+ New Question'}
        </button>
        <button className="btn-small" onClick={loadQuestions}>Refresh</button>
      </div>

      {showCreateForm && (
        <div className="admin-form-panel">
          <h2>Create Question</h2>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label>Question</label>
              <textarea
                rows={3}
                required
                placeholder="Enter the interview question..."
                value={createForm.question_text}
                onChange={e => setCreateForm({ ...createForm, question_text: e.target.value })}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AWS, System Design..."
                  value={createForm.category}
                  onChange={e => setCreateForm({ ...createForm, category: e.target.value })}
                />
              </div>
              <div className="form-group">
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
            <div className="form-group">
              <label>Reference Answer (optional)</label>
              <textarea
                rows={4}
                placeholder="Model answer..."
                value={createForm.reference_answer}
                onChange={e => setCreateForm({ ...createForm, reference_answer: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary">Create</button>
          </form>
        </div>
      )}

      {editingQuestion && (
        <div className="admin-form-panel">
          <h2>Edit Question</h2>
          <form onSubmit={handleUpdate}>
            <div className="form-group">
              <label>Question</label>
              <textarea
                rows={3}
                required
                value={editingQuestion.question_text}
                onChange={e => setEditingQuestion({ ...editingQuestion, question_text: e.target.value })}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <input
                  type="text"
                  required
                  value={editingQuestion.category}
                  onChange={e => setEditingQuestion({ ...editingQuestion, category: e.target.value })}
                />
              </div>
              <div className="form-group">
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
            <div className="form-group">
              <label>Reference Answer</label>
              <textarea
                rows={4}
                value={editingQuestion.reference_answer}
                onChange={e => setEditingQuestion({ ...editingQuestion, reference_answer: e.target.value })}
              />
            </div>
            <div className="form-buttons">
              <button type="submit" className="btn-primary">Save</button>
              <button type="button" className="btn-secondary" onClick={() => setEditingQuestion(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search questions..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>Category</label>
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Difficulty</label>
          <select value={selectedDifficulty} onChange={e => setSelectedDifficulty(e.target.value)}>
            {difficulties.map(d => <option key={d}>{capitalize(d)}</option>)}
          </select>
        </div>
      </div>

      <div className="questions-list">
        {filteredQuestions.length === 0 ? (
          <p className="no-results">
            {questions.length === 0 ? 'No questions yet. Create one above.' : 'No questions match your filters.'}
          </p>
        ) : (
          filteredQuestions.map(q => (
            <div key={q.id} className="question-card">
              <div className="question-header">
                <h3>{q.question_text}</h3>
                <span className={difficultyClass(q.difficulty)}>{capitalize(q.difficulty)}</span>
              </div>
              <div className="question-footer">
                <div className="question-tags">
                  <span className="tag">{q.category}</span>
                </div>
                <div className="admin-buttons">
                  <button
                    className="btn-small btn-edit"
                    onClick={() => {
                      setEditingQuestion(q)
                      setShowCreateForm(false)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn-small btn-delete"
                    onClick={() => handleDelete(q.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="results-count">
        {filteredQuestions.length} of {questions.length} questions
      </div>
    </div>
  )
}

export default Admin
