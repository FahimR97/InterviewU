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

const emptyForm = { title: '', situation: '', task: '', action: '', result: '', tags: [] as string[] }

export default function Stories() {
  const { user, getAuthToken } = useAuth()
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Story | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [filterTag, setFilterTag] = useState('All')
  const [search, setSearch] = useState('')

  const loadStories = async () => {
    try {
      setLoading(true)
      const token = await getAuthToken()
      const data = await getStories(token)
      setStories(data.sort((a, b) => b.updated_at.localeCompare(a.updated_at)))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user) loadStories() }, [user])

  const filtered = useMemo(() => {
    return stories.filter(s => {
      const matchesTag = filterTag === 'All' || s.tags.includes(filterTag)
      const matchesSearch = !search || s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.situation.toLowerCase().includes(search.toLowerCase())
      return matchesTag && matchesSearch
    })
  }, [stories, filterTag, search])

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

  if (!user) return <div className="stories-page"><p>Sign in to access your stories.</p></div>

  return (
    <div className="stories-page">
      <div className="stories-header">
        <div>
          <h1>STAR Story Builder</h1>
          <p className="stories-subtitle">Build and organise your interview stories by Leadership Principle</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setEditing(null); setForm(emptyForm) }}>
          {showForm ? 'Cancel' : '+ New Story'}
        </button>
      </div>

      {showForm && (
        <div className="story-form">
          <h2>{editing ? 'Edit Story' : 'New Story'}</h2>
          <div className="form-group">
            <label>Title</label>
            <input type="text" placeholder="Give your story a short title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Leadership Principles</label>
            <div className="tag-picker">
              {LEADERSHIP_PRINCIPLES.map(lp => (
                <button key={lp} className={`tag-btn ${form.tags.includes(lp) ? 'active' : ''}`} onClick={() => toggleTag(lp)}>{lp}</button>
              ))}
            </div>
          </div>
          <div className="star-sections">
            <div className="form-group">
              <label>Situation</label>
              <textarea rows={3} placeholder="Set the scene. What was the context?" value={form.situation} onChange={e => setForm({ ...form, situation: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Task</label>
              <textarea rows={3} placeholder="What was your responsibility? What needed to happen?" value={form.task} onChange={e => setForm({ ...form, task: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Action</label>
              <textarea rows={4} placeholder="What did YOU specifically do? Include metrics and data." value={form.action} onChange={e => setForm({ ...form, action: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Result</label>
              <textarea rows={3} placeholder="What was the outcome? Quantify the impact." value={form.result} onChange={e => setForm({ ...form, result: e.target.value })} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={handleSubmit}>{editing ? 'Save Changes' : 'Create Story'}</button>
            <button className="btn-ghost" onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm) }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="stories-filters">
        <input type="text" className="stories-search" placeholder="Search stories..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={filterTag} onChange={e => setFilterTag(e.target.value)}>
          <option value="All">All Principles</option>
          {LEADERSHIP_PRINCIPLES.map(lp => <option key={lp} value={lp}>{lp}</option>)}
        </select>
      </div>

      <div className="stories-count">{filtered.length} {filtered.length === 1 ? 'story' : 'stories'}</div>

      {loading ? <p>Loading...</p> : filtered.length === 0 ? (
        <div className="stories-empty">
          <p>{stories.length === 0 ? 'No stories yet. Create your first STAR story above.' : 'No stories match your filters.'}</p>
        </div>
      ) : (
        <div className="stories-list">
          {filtered.map(story => (
            <div key={story.storyId} className="story-card">
              <div className="story-card-header">
                <h3>{story.title}</h3>
                <div className="story-card-actions">
                  <button className="btn-sm" onClick={() => handleEdit(story)}>Edit</button>
                  <button className="btn-sm btn-danger" onClick={() => handleDelete(story.storyId)}>Delete</button>
                </div>
              </div>
              <div className="story-tags">
                {story.tags.map(tag => <span key={tag} className="story-tag">{tag}</span>)}
              </div>
              <div className="star-preview">
                {story.situation && <div className="star-section"><strong>S</strong><p>{story.situation}</p></div>}
                {story.task && <div className="star-section"><strong>T</strong><p>{story.task}</p></div>}
                {story.action && <div className="star-section"><strong>A</strong><p>{story.action}</p></div>}
                {story.result && <div className="star-section"><strong>R</strong><p>{story.result}</p></div>}
              </div>
              <div className="story-meta">Updated {new Date(story.updated_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
