import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getStories, createStory, updateStory, deleteStory } from '../services/api'
import type { Story } from '../services/api'
import './Stories.css'

const LEADERSHIP_PRINCIPLES = [
  'Customer Obsession', 'Ownership', 'Learn and Be Curious',
  'Insist on the Highest Standards', 'Bias for Action',
  'Earn Trust', 'Dive Deep', 'Deliver Results',
]

const STAR_META = [
  { key: 'situation' as const, label: 'Situation', letter: 'S', hint: 'Set the scene. What was the context and what was at stake?' },
  { key: 'task' as const, label: 'Task', letter: 'T', hint: 'What was your responsibility? What needed to happen?' },
  { key: 'action' as const, label: 'Action', letter: 'A', hint: 'What did YOU specifically do? Be specific — use "I", not "we".' },
  { key: 'result' as const, label: 'Result', letter: 'R', hint: 'What was the outcome? Quantify impact with metrics where possible.' },
]

const emptyForm = { title: '', situation: '', task: '', action: '', result: '', tags: [] as string[] }

function wordCount(str: string) {
  return str.trim() ? str.trim().split(/\s+/).length : 0
}

export default function Stories() {
  const { user, getAuthToken } = useAuth()
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Story | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [filterTag, setFilterTag] = useState('All')
  const [search, setSearch] = useState('')
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  const loadStories = async () => {
    try {
      setLoading(true)
      const token = await getAuthToken()
      const data = await getStories(token)
      setStories(data.sort((a, b) => b.updated_at.localeCompare(a.updated_at)))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { if (user) loadStories() }, [user])

  const filtered = useMemo(() => {
    return stories.filter(s => {
      const matchesTag = filterTag === 'All' || s.tags.includes(filterTag)
      const matchesSearch = !search || s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.situation.toLowerCase().includes(search.toLowerCase())
      return matchesTag && matchesSearch
    })
  }, [stories, filterTag, search])

  const coveredPrinciples = useMemo(
    () => new Set(stories.flatMap(s => s.tags)).size,
    [stories]
  )

  const handleSubmit = async () => {
    if (!form.title.trim()) return
    const token = await getAuthToken()
    if (editing) {
      await updateStory(editing.storyId, form, token)
    } else {
      await createStory(form, token)
    }
    setForm(emptyForm)
    setShowForm(false)
    setEditing(null)
    loadStories()
  }

  const handleEdit = (story: Story) => {
    setForm({ title: story.title, situation: story.situation, task: story.task, action: story.action, result: story.result, tags: story.tags })
    setEditing(story)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (storyId: string) => {
    if (!confirm('Delete this story?')) return
    const token = await getAuthToken()
    await deleteStory(storyId, token)
    loadStories()
  }

  const toggleTag = (tag: string) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
    }))
  }

  const toggleExpanded = (storyId: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev)
      if (next.has(storyId)) { next.delete(storyId) } else { next.add(storyId) }
      return next
    })
  }

  if (!user) return <div className="stories-page"><p>Sign in to access your stories.</p></div>

  return (
    <div className="stories-page">
      <div className="stories-hero">
        <div className="stories-hero-content">
          <h1>STAR Story Builder</h1>
          <p className="stories-subtitle">Build and organise your interview stories by Leadership Principle</p>
          {stories.length > 0 && (
            <div className="stories-stats">
              <span>{stories.length} {stories.length === 1 ? 'story' : 'stories'}</span>
              <span className="stories-stats-sep">·</span>
              <span>{coveredPrinciples} of {LEADERSHIP_PRINCIPLES.length} principles covered</span>
            </div>
          )}
        </div>
        <button
          className="btn-primary"
          onClick={() => { setShowForm(!showForm); setEditing(null); setForm(emptyForm) }}
        >
          {showForm ? 'Cancel' : '+ New Story'}
        </button>
      </div>

      {showForm && (
        <div className="story-form">
          <h2>{editing ? 'Edit Story' : 'New Story'}</h2>
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              placeholder="Give your story a short title"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Leadership Principles</label>
            <div className="tag-picker">
              {LEADERSHIP_PRINCIPLES.map(lp => (
                <button
                  key={lp}
                  className={`tag-btn ${form.tags.includes(lp) ? 'active' : ''}`}
                  onClick={() => toggleTag(lp)}
                >
                  {lp}
                </button>
              ))}
            </div>
          </div>
          <div className="star-sections">
            {STAR_META.map(({ key, label, letter, hint }) => (
              <div key={key} className="form-group star-field">
                <div className="star-label-row">
                  <span className={`star-letter star-letter--${letter.toLowerCase()}`}>{letter}</span>
                  <label>{label}</label>
                  <span className="word-count">{wordCount(form[key])} words</span>
                </div>
                <textarea
                  rows={key === 'action' ? 4 : 3}
                  placeholder={hint}
                  value={form[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={handleSubmit}>
              {editing ? 'Save Changes' : 'Create Story'}
            </button>
            <button className="btn-ghost" onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm) }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="stories-filters">
        <input
          type="text"
          className="stories-search"
          placeholder="Search stories..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={filterTag} onChange={e => setFilterTag(e.target.value)}>
          <option value="All">All Principles</option>
          {LEADERSHIP_PRINCIPLES.map(lp => <option key={lp} value={lp}>{lp}</option>)}
        </select>
      </div>

      <div className="stories-count">{filtered.length} {filtered.length === 1 ? 'story' : 'stories'}</div>

      {loading ? (
        <p className="stories-loading">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="stories-empty">
          <div className="stories-empty-icon">📖</div>
          <p>{stories.length === 0
            ? 'No stories yet. Create your first STAR story above.'
            : 'No stories match your filters.'
          }</p>
        </div>
      ) : (
        <div className="stories-list">
          {filtered.map(story => {
            const isExpanded = expandedCards.has(story.storyId)
            const completion = STAR_META.filter(({ key }) => story[key]?.trim()).length
            return (
              <div key={story.storyId} className="story-card">
                <div className="story-card-header">
                  <div className="story-card-title-row">
                    <h3>{story.title}</h3>
                    <div className="story-completion">
                      {STAR_META.map(({ key, letter }) => (
                        <span
                          key={key}
                          className={`completion-dot completion-dot--${letter.toLowerCase()} ${story[key]?.trim() ? 'completion-dot--filled' : ''}`}
                          title={letter}
                        >
                          {letter}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="story-card-actions">
                    <button className="btn-sm" onClick={() => toggleExpanded(story.storyId)}>
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </button>
                    <button className="btn-sm" onClick={() => handleEdit(story)}>Edit</button>
                    <button className="btn-sm btn-danger" onClick={() => handleDelete(story.storyId)}>Delete</button>
                  </div>
                </div>

                <div className="story-tags">
                  {story.tags.map(tag => <span key={tag} className="story-tag">{tag}</span>)}
                </div>

                {!isExpanded && story.situation && (
                  <p className="story-snippet">
                    {story.situation.length > 140
                      ? story.situation.slice(0, 140) + '…'
                      : story.situation}
                  </p>
                )}

                {isExpanded && (
                  <div className="star-preview">
                    {STAR_META.map(({ key, letter, label }) => story[key] && (
                      <div key={key} className={`star-section star-section--${letter.toLowerCase()}`}>
                        <div className="star-section-label">
                          <span className={`star-letter star-letter--${letter.toLowerCase()}`}>{letter}</span>
                          <strong>{label}</strong>
                        </div>
                        <p>{story[key]}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="story-meta">
                  <span>Updated {new Date(story.updated_at).toLocaleDateString()}</span>
                  <span>{completion}/4 sections complete</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
