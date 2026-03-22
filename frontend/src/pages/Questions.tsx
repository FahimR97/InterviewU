import { useState, useMemo, useEffect, lazy, Suspense } from 'react'
import Editor from '@monaco-editor/react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { getAllQuestions, evaluateAnswer } from '../services/api'
import type { Question, EvaluationResponse } from '../services/api'
import '@excalidraw/excalidraw/index.css'
import './Questions.css'

const ExcalidrawCanvas = lazy(() =>
  import('@excalidraw/excalidraw').then(m => ({ default: m.Excalidraw }))
)

interface LangOption { label: string; monacoId: string; starter: string }

const LANGUAGES: LangOption[] = [
  { label: 'Python',     monacoId: 'python',     starter: '# Write your solution here\n' },
  { label: 'JavaScript', monacoId: 'javascript',  starter: '// Write your solution here\n' },
  { label: 'TypeScript', monacoId: 'typescript',  starter: '// Write your solution here\n' },
  { label: 'Java',       monacoId: 'java',        starter: '// Write your solution here\n' },
  { label: 'Go',         monacoId: 'go',          starter: '// Write your solution here\n' },
  { label: 'Bash',       monacoId: 'shell',       starter: '#!/bin/bash\n# Write your solution here\n' },
]

function isCodingQuestion(q: Question): boolean {
  return `${q.category} ${q.competency}`.toLowerCase().match(/cod|programming|algorithm/) !== null
}

function isSystemDesignQuestion(q: Question): boolean {
  return `${q.category} ${q.competency}`.toLowerCase().match(/system.design|architecture|design/) !== null
}

type SdTab = 'clarifying' | 'requirements' | 'design' | 'deepdive' | 'tradeoffs'
interface SdSections { clarifying: string; requirements: string; design: string; deepdive: string; tradeoffs: string }
const EMPTY_SD: SdSections = { clarifying: '', requirements: '', design: '', deepdive: '', tradeoffs: '' }

const SD_TABS: { id: SdTab; label: string; hint: string }[] = [
  { id: 'clarifying',   label: 'Clarify',       hint: 'What questions would you ask the interviewer before you start designing? (Users, scale, SLAs, read/write ratio, consistency…)' },
  { id: 'requirements', label: 'Requirements',   hint: 'Functional requirements (what it does) and non-functional requirements (scale, latency, availability, durability).' },
  { id: 'design',       label: 'Architecture',   hint: 'High-level components and data flow. Core services, how they communicate, where the main data stores sit.' },
  { id: 'deepdive',     label: 'Deep Dive',      hint: 'Pick the hardest component and go deeper — data model, API design, database choice, caching, queuing strategy.' },
  { id: 'tradeoffs',    label: 'Tradeoffs',      hint: 'Why these choices? Failure modes and how you handle them. What would change at 10x scale?' },
]

function buildSdAnswer(s: SdSections): string {
  const parts: string[] = []
  if (s.clarifying.trim())   parts.push(`=== CLARIFYING QUESTIONS ===\n${s.clarifying.trim()}`)
  if (s.requirements.trim()) parts.push(`=== REQUIREMENTS ===\n${s.requirements.trim()}`)
  if (s.design.trim())       parts.push(`=== HIGH-LEVEL ARCHITECTURE ===\n${s.design.trim()}`)
  if (s.deepdive.trim())     parts.push(`=== DEEP DIVE ===\n${s.deepdive.trim()}`)
  if (s.tradeoffs.trim())    parts.push(`=== TRADEOFFS & FAILURE MODES ===\n${s.tradeoffs.trim()}`)
  return parts.join('\n\n')
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function ScoreMeter({ score }: { score: number }) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const colour = score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <svg width="100" height="100" className="score-meter">
      <circle cx="50" cy="50" r={radius} className="score-meter-track" />
      <circle
        cx="50" cy="50" r={radius}
        className="score-meter-fill"
        stroke={colour}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
      <text x="50" y="47" textAnchor="middle" className="score-meter-value">{score}</text>
      <text x="50" y="62" textAnchor="middle" className="score-meter-sub">/100</text>
    </svg>
  )
}

function PracticeView({
  question,
  onBack,
  getAuthToken,
  theme,
}: {
  question: Question
  onBack: () => void
  getAuthToken: () => Promise<string | null>
  theme: string
}) {
  const [userAnswer, setUserAnswer] = useState('')
  const [selectedLang, setSelectedLang] = useState<LangOption>(LANGUAGES[0])
  const [evaluating, setEvaluating] = useState(false)
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null)
  const [sdSections, setSdSections] = useState<SdSections>(EMPTY_SD)
  const [sdTab, setSdTab] = useState<SdTab>('clarifying')
  const [canvasFs, setCanvasFs] = useState(false)

  const isCoding = isCodingQuestion(question)
  const isSd = isSystemDesignQuestion(question)

  const handleLangChange = (lang: LangOption) => {
    setSelectedLang(lang)
    setUserAnswer(lang.starter)
  }

  const handleSubmit = async () => {
    const answerToSend = isSd ? buildSdAnswer(sdSections) : userAnswer
    if (!answerToSend.trim()) return
    try {
      setEvaluating(true)
      const token = await getAuthToken()
      const result = await evaluateAnswer(
        {
          question: question.question_text,
          answer: answerToSend,
          competency_type: question.competency,
          question_id: question.id,
          category: question.category,
          difficulty: question.difficulty,
          mode: 'practice',
        },
        token
      )
      setEvaluation(result)
    } catch (err) {
      console.error('Error evaluating answer:', err)
      alert(err instanceof Error ? err.message : 'Failed to evaluate answer')
    } finally {
      setEvaluating(false)
    }
  }

  return (
    <div className="practice-view">
      {/* Header bar */}
      <div className="practice-header">
        <button className="practice-back-btn" onClick={onBack}>
          ← Back to Questions
        </button>
        <div className="practice-header-meta">
          <span className={`difficulty difficulty-${question.difficulty.toLowerCase()}`}>
            {capitalize(question.difficulty)}
          </span>
          <span className="practice-category-pill">{question.category}</span>
        </div>
      </div>

      {/* Single centered column */}
      <div className="practice-content">

        {/* Question + hints */}
        <div className="practice-question-panel">
          <p className="practice-panel-eyebrow">Question</p>
          <h2 className="practice-question-text">{question.question_text}</h2>
          {isSd && (
            <div className="sd-context">
              <span className="sd-hint-label">Think about:</span>
              <div className="sd-hints">
                {['Scale & capacity', 'Core components', 'Data model & APIs', 'Caching & queuing', 'Failure modes'].map(h => (
                  <span key={h} className="sd-hint-tag">{h}</span>
                ))}
              </div>
            </div>
          )}
          {question.reference_answer && (
            <details className="practice-reference">
              <summary>Show reference answer</summary>
              <p>{question.reference_answer}</p>
            </details>
          )}
        </div>

        {/* Answer + feedback */}
        {!evaluation ? (
          <div className="practice-answer-panel">
            <p className="practice-panel-eyebrow">Your Answer</p>

            {isSd ? (
              <div className="sd-answer">
                <div className="sd-tabs">
                  {SD_TABS.map(tab => (
                    <button
                      key={tab.id}
                      className={`sd-tab-btn${sdTab === tab.id ? ' active' : ''}${sdSections[tab.id].trim() ? ' filled' : ''}`}
                      onClick={() => setSdTab(tab.id)}
                      disabled={evaluating}
                    >
                      {tab.label}
                      {sdSections[tab.id].trim() && <span className="sd-tab-dot" />}
                    </button>
                  ))}
                </div>
                {SD_TABS.map(tab => (
                  tab.id === 'design' ? (
                    <div key={tab.id} className={`sd-section${sdTab === tab.id ? ' active' : ''}`}>
                      <p className="sd-section-hint">{tab.hint}</p>
                      <div className={`sd-canvas-wrap${canvasFs ? ' sd-fullscreen' : ''}`}>
                        <button className="sd-fs-btn" onClick={() => setCanvasFs(f => !f)} title={canvasFs ? 'Exit fullscreen' : 'Expand canvas'}>
                          {canvasFs ? '✕' : '⛶'}
                        </button>
                        <Suspense fallback={<div className="sd-canvas-loading">Loading whiteboard…</div>}>
                          <ExcalidrawCanvas theme={theme === 'dark' ? 'dark' : 'light'} />
                        </Suspense>
                      </div>
                      <p className="sd-canvas-label">Describe your architecture for Marcus to evaluate:</p>
                      <textarea
                        value={sdSections.design}
                        onChange={e => setSdSections(prev => ({ ...prev, design: e.target.value }))}
                        placeholder="Components, data flow, key design decisions…"
                        rows={6}
                        disabled={evaluating}
                      />
                    </div>
                  ) : (
                    <div key={tab.id} className={`sd-section${sdTab === tab.id ? ' active' : ''}`}>
                      <p className="sd-section-hint">{tab.hint}</p>
                      <textarea
                        value={sdSections[tab.id]}
                        onChange={e => setSdSections(prev => ({ ...prev, [tab.id]: e.target.value }))}
                        placeholder={`Write your ${tab.label.toLowerCase()} here…`}
                        rows={12}
                        disabled={evaluating}
                      />
                    </div>
                  )
                ))}
              </div>
            ) : isCoding ? (
                <div className="practice-monaco-wrap">
                  <div className="practice-lang-bar">
                    {LANGUAGES.map(lang => (
                      <button
                        key={lang.monacoId}
                        className={`lang-btn ${selectedLang.monacoId === lang.monacoId ? 'lang-btn-active' : ''}`}
                        onClick={() => handleLangChange(lang)}
                        disabled={evaluating}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                  <Editor
                    height="340px"
                    language={selectedLang.monacoId}
                    value={userAnswer}
                    onChange={val => setUserAnswer(val || '')}
                    theme={theme === 'dark' ? 'vs-dark' : 'light'}
                    options={{
                      fontSize: 14,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      lineNumbers: 'on',
                      padding: { top: 12, bottom: 12 },
                    }}
                  />
                </div>
              ) : (
                <textarea
                  className="practice-textarea"
                  value={userAnswer}
                  onChange={e => setUserAnswer(e.target.value)}
                  placeholder="Write your answer here — treat this like a real interview response..."
                  rows={14}
                  disabled={evaluating}
                />
              )}

              <button
                className="btn-evaluate"
                onClick={handleSubmit}
                disabled={evaluating || (isSd ? buildSdAnswer(sdSections).trim().length === 0 : !userAnswer.trim())}
              >
                {evaluating ? (
                  <>
                    <span className="btn-spinner" />
                    Marcus is evaluating…
                  </>
                ) : (
                  'Get AI Feedback →'
                )}
              </button>
            </div>
          ) : (
            <div className="practice-feedback">
              {/* Score header */}
              <div className="feedback-score-row">
                <ScoreMeter score={evaluation.score} />
                <div className="feedback-score-meta">
                  <h3 className="feedback-heading">Marcus's Feedback</h3>
                  <div className={`feedback-verdict ${evaluation.is_correct ? 'verdict-correct' : 'verdict-improve'}`}>
                    {evaluation.is_correct ? '✓ Correct approach' : '⚠ Needs improvement'}
                  </div>
                </div>
              </div>

              <div className="feedback-section feedback-strengths">
                <h4>💪 Strengths</h4>
                <ul>{evaluation.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>

              <div className="feedback-section feedback-improvements">
                <h4>🎯 Areas to Improve</h4>
                <ul>{evaluation.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>

              <div className="feedback-section feedback-suggestions">
                <h4>💡 Suggestions</h4>
                <ul>{evaluation.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>

              <div className="marcus-comment">
                <span className="marcus-label">🤖 Marcus</span>
                <p>{evaluation.marcus_comment}</p>
              </div>

              <button
                className="btn-try-again"
                onClick={() => {
                  setUserAnswer('')
                  setSdSections(EMPTY_SD)
                  setSdTab('clarifying')
                  setEvaluation(null)
                }}
              >
                Try Again
              </button>
            </div>
          )}

      </div>
    </div>
  )
}

export default function Questions() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedDifficulty, setSelectedDifficulty] = useState('All')
  const [selectedCompetency, setSelectedCompetency] = useState('All')
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [practiceView, setPracticeView] = useState<Question | null>(null)
  const { user, getAuthToken } = useAuth()
  const { theme } = useTheme()

  const loadQuestions = async () => {
    if (!user) {
      setLoading(false)
      setQuestions([])
      return
    }
    try {
      setLoading(true)
      setError(null)
      const token = await getAuthToken()
      const data = await getAllQuestions(token)
      setQuestions(data)
    } catch (err) {
      console.error('Error loading questions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load questions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQuestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const categories = useMemo(() => {
    const cats = new Set(questions.map(q => q.category).filter(Boolean))
    return ['All', ...Array.from(cats)]
  }, [questions])

  const difficulties = useMemo(() => {
    const diffs = new Set(questions.map(q => q.difficulty.toLowerCase()).filter(Boolean))
    return ['All', ...Array.from(diffs)]
  }, [questions])

  const competencies = useMemo(() => {
    if (selectedCategory === 'All') return []
    const comps = new Set(questions.filter(q => q.category === selectedCategory).map(q => q.competency).filter(Boolean))
    return comps.size > 1 ? ['All', ...Array.from(comps).sort()] : []
  }, [questions, selectedCategory])

  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      const matchesSearch =
        q.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.difficulty.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.category.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === 'All' || q.category === selectedCategory
      const matchesDifficulty =
        selectedDifficulty === 'All' ||
        q.difficulty.toLowerCase() === selectedDifficulty.toLowerCase()
      const matchesCompetency = selectedCompetency === 'All' || q.competency === selectedCompetency
      return matchesSearch && matchesCategory && matchesDifficulty && matchesCompetency
    })
  }, [questions, searchTerm, selectedCategory, selectedDifficulty, selectedCompetency])

  // Practice view replaces the full list
  if (practiceView) {
    return (
      <div className="questions-container">
        <PracticeView
          question={practiceView}
          onBack={() => setPracticeView(null)}
          getAuthToken={getAuthToken}
          theme={theme}
        />
      </div>
    )
  }

  return (
    <div className="questions-container">

      {/* ── Hero ── */}
      <div className="qbank-hero">
        <div className="qbank-hero-orb orb-a" />
        <div className="qbank-hero-orb orb-b" />
        <div className="qbank-hero-pill">
          <span className="qbank-hero-dot" />
          AI-Powered Practice
        </div>
        <h1 className="qbank-hero-title">Question Bank</h1>
        <p className="qbank-hero-subtitle">
          Curated interview questions across system design, DevOps, cloud, algorithms and more.
          Answer anything and get instant AI-scored feedback from Marcus.
        </p>
        {user && !loading && questions.length > 0 && (
          <div className="qbank-hero-stats">
            <div className="qbank-stat">
              <span className="qbank-stat-num">{questions.length}</span>
              <span className="qbank-stat-label">Questions</span>
            </div>
            <div className="qbank-stat-div" />
            <div className="qbank-stat">
              <span className="qbank-stat-num">{categories.length - 1}</span>
              <span className="qbank-stat-label">Categories</span>
            </div>
            <div className="qbank-stat-div" />
            <div className="qbank-stat">
              <span className="qbank-stat-num">AI</span>
              <span className="qbank-stat-label">Scored</span>
            </div>
          </div>
        )}
      </div>

      {!user && (
        <div className="warning-box">
          <p>Sign in to access the question bank and start practising.</p>
        </div>
      )}

      {user && (
        <>
          {/* ── Filters ── */}
          <div className="filters">
            <div className="search-box">
              <svg className="search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="8.5" cy="8.5" r="5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M14 14l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search questions…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="filter-group">
              <label>Category</label>
              <select
                value={selectedCategory}
                onChange={e => { setSelectedCategory(e.target.value); setSelectedCompetency('All') }}
                disabled={loading}
              >
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            {competencies.length > 0 && (
              <div className="filter-group">
                <label>Subcategory</label>
                <select
                  value={selectedCompetency}
                  onChange={e => setSelectedCompetency(e.target.value)}
                  disabled={loading}
                >
                  {competencies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            <div className="filter-group">
              <label>Difficulty</label>
              <select
                value={selectedDifficulty}
                onChange={e => setSelectedDifficulty(e.target.value)}
                disabled={loading}
              >
                {difficulties.map(d => <option key={d} value={d}>{capitalize(d)}</option>)}
              </select>
            </div>

            <button className="btn-refresh" onClick={loadQuestions} disabled={loading} title="Refresh">
              {loading ? '…' : '↺'}
            </button>
          </div>

          {loading && (
            <div className="loading-container">
              <div className="loading-spinner" />
              <p>Loading questions…</p>
            </div>
          )}

          {error && (
            <div className="error-box">
              <p>Failed to load questions: {error}</p>
              <button className="btn-refresh-inline" onClick={loadQuestions}>Retry</button>
            </div>
          )}

          {!loading && !error && (
            <>
              <p className="results-count">
                {filteredQuestions.length} of {questions.length} questions
              </p>

              <div className="questions-list">
                {filteredQuestions.length === 0 ? (
                  <div className="no-results">
                    <p>
                      {questions.length === 0
                        ? 'No questions available yet.'
                        : 'No questions match your filters.'}
                    </p>
                  </div>
                ) : (
                  filteredQuestions.map((question, idx) => (
                    <div
                      key={question.id}
                      className="question-card"
                      style={{ animationDelay: `${Math.min(idx * 0.04, 0.4)}s` }}
                    >
                      <div className="question-header">
                        <h3>{question.question_text}</h3>
                        <span className={`difficulty difficulty-${question.difficulty.toLowerCase()}`}>
                          {capitalize(question.difficulty)}
                        </span>
                      </div>
                      <div className="question-footer">
                        <span className="tag">{capitalize(question.category)}</span>
                        <button
                          className="btn-practice"
                          onClick={() => setPracticeView(question)}
                        >
                          Practice →
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}