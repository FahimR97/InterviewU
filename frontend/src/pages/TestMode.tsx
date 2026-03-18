import { useState, useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { getAllQuestions, evaluateAnswer } from '../services/api'
import type { Question, EvaluationResponse } from '../services/api'
import './TestMode.css'

type TestMode = 'behavioural' | 'coding' | 'system_design' | 'networking' | 'linux' | 'full'
type Screen = 'mode-picker' | 'count-picker' | 'intro' | 'question' | 'complete'

interface LangOption {
  label: string
  monacoId: string
  starter: string
}

const LANGUAGES: LangOption[] = [
  { label: 'Python',     monacoId: 'python',     starter: '# Write your solution here\n' },
  { label: 'JavaScript', monacoId: 'javascript',  starter: '// Write your solution here\n' },
  { label: 'TypeScript', monacoId: 'typescript',  starter: '// Write your solution here\n' },
  { label: 'Java',       monacoId: 'java',        starter: '// Write your solution here\n' },
  { label: 'Go',         monacoId: 'go',          starter: '// Write your solution here\n' },
  { label: 'Bash',       monacoId: 'shell',       starter: '#!/bin/bash\n# Write your solution here\n' },
]

interface ModeConfig {
  label: string
  description: string
  emoji: string
  categories: string[]
}

const MODE_CONFIG: Record<TestMode, ModeConfig> = {
  behavioural: {
    label: 'Behavioural',
    description: 'Competency and situational questions',
    emoji: '🧠',
    categories: ['behavioural', 'behavioral', 'leadership', 'soft skills', 'competency'],
  },
  coding: {
    label: 'Coding',
    description: 'Technical coding and algorithms',
    emoji: '💻',
    categories: ['coding', 'programming', 'algorithms', 'data structures'],
  },
  system_design: {
    label: 'System Design',
    description: 'Architecture and scalability',
    emoji: '🏗️',
    categories: ['system design', 'architecture', 'design'],
  },
  networking: {
    label: 'Networking',
    description: 'TCP/IP, DNS, HTTP, protocols',
    emoji: '🌐',
    categories: ['networking', 'network', 'tcp', 'dns', 'http', 'protocol'],
  },
  linux: {
    label: 'Linux',
    description: 'Linux, shell, OS fundamentals',
    emoji: '🐧',
    categories: ['linux', 'unix', 'bash', 'shell', 'kernel', 'operating system'],
  },
  full: {
    label: 'Full Interview',
    description: 'Mixed questions across all topics',
    emoji: '🎯',
    categories: [],
  },
}

const COUNT_OPTIONS = [5, 10, 15, 0] // 0 = all

function isCodingQuestion(question: Question): boolean {
  const text = `${question.category} ${question.competency}`.toLowerCase()
  return text.includes('cod') || text.includes('programming') || text.includes('algorithm')
}

function filterByMode(questions: Question[], mode: TestMode): Question[] {
  if (mode === 'full') return questions
  const cats = MODE_CONFIG[mode].categories
  return questions.filter(q => {
    const text = `${q.category} ${q.competency}`.toLowerCase()
    return cats.some(c => text.includes(c))
  })
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function getMarcusSummary(name: string | null, scores: number[]): string {
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  const firstName = name?.split(' ')[0] || 'there'

  if (avg >= 80) {
    return `Strong performance, ${firstName}. You averaged ${avg}/100 across ${scores.length} questions — that's genuinely solid. Keep that consistency going into the real thing.`
  }
  if (avg >= 60) {
    return `Good effort, ${firstName}. You averaged ${avg}/100. You're on the right track but there are gaps worth addressing. Review the areas marked for improvement and practice those specifically.`
  }
  return `You averaged ${avg}/100, ${firstName}. There's real work to do here, but that's exactly what this is for. Go back through the feedback on each answer and focus on the weak areas before your next session.`
}

export default function TestMode() {
  const { user, userName, getAuthToken } = useAuth()
  const { theme } = useTheme()

  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [loadingQuestions, setLoadingQuestions] = useState(false)

  const [screen, setScreen] = useState<Screen>('mode-picker')
  const [selectedMode, setSelectedMode] = useState<TestMode | null>(null)
  const [selectedCount, setSelectedCount] = useState<number>(10)
  const [queue, setQueue] = useState<Question[]>([])
  const [qIndex, setQIndex] = useState(0)

  const [textAnswer, setTextAnswer] = useState('')
  const [selectedLang, setSelectedLang] = useState<LangOption>(LANGUAGES[0])
  const [codeAnswer, setCodeAnswer] = useState(LANGUAGES[0].starter)
  const [submitting, setSubmitting] = useState(false)
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null)
  const [sessionScores, setSessionScores] = useState<number[]>([])

  // Stopwatch
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!user) return
    setLoadingQuestions(true)
    getAuthToken()
      .then(token => getAllQuestions(token))
      .then(data => setAllQuestions(data))
      .catch(err => console.error('Failed to load questions:', err))
      .finally(() => setLoadingQuestions(false))
  }, [user, getAuthToken])

  // Start/stop timer based on screen
  useEffect(() => {
    if (screen === 'question') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [screen])

  const handleModeSelect = (mode: TestMode) => {
    setSelectedMode(mode)
    setScreen('count-picker')
  }

  const handleCountSelect = (count: number) => {
    const mode = selectedMode!
    const filtered = filterByMode(allQuestions, mode)
    const shuffled = shuffle(filtered)
    const final = count === 0 ? shuffled : shuffled.slice(0, count)
    setSelectedCount(count)
    setQueue(final)
    setQIndex(0)
    setSessionScores([])
    setElapsed(0)
    setScreen('intro')
  }

  const handleBegin = () => {
    setTextAnswer('')
    setSelectedLang(LANGUAGES[0])
    setCodeAnswer(LANGUAGES[0].starter)
    setEvaluation(null)
    setScreen('question')
  }

  const handleLangChange = (lang: LangOption) => {
    setSelectedLang(lang)
    setCodeAnswer(lang.starter)
  }

  const handleSubmit = async () => {
    const currentQ = queue[qIndex]
    if (!currentQ) return
    const answer = isCodingQuestion(currentQ) ? codeAnswer : textAnswer
    if (!answer.trim()) return

    try {
      setSubmitting(true)
      const token = await getAuthToken()
      const result = await evaluateAnswer(
        {
          question: currentQ.question_text,
          answer,
          competency_type: currentQ.competency,
          question_id: currentQ.id,
          category: currentQ.category,
          difficulty: currentQ.difficulty,
          mode: 'test',
        },
        token
      )
      setEvaluation(result)
      setSessionScores(prev => [...prev, result.score])
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit answer')
    } finally {
      setSubmitting(false)
    }
  }

  const handleNext = () => {
    const nextIndex = qIndex + 1
    if (nextIndex >= queue.length) {
      setScreen('complete')
    } else {
      setQIndex(nextIndex)
      setEvaluation(null)
      setTextAnswer('')
      setSelectedLang(LANGUAGES[0])
      setCodeAnswer(LANGUAGES[0].starter)
    }
  }

  const handleRestart = () => {
    setScreen('mode-picker')
    setSelectedMode(null)
    setQueue([])
    setQIndex(0)
    setEvaluation(null)
    setSessionScores([])
    setElapsed(0)
  }

  if (!user) {
    return (
      <div className="test-container">
        <div className="test-auth-warning">
          <p>Please sign in to access test mode.</p>
        </div>
      </div>
    )
  }

  const currentQ = queue[qIndex]
  const sessionAvg = sessionScores.length > 0
    ? Math.round(sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length)
    : null

  return (
    <div className="test-container">

      {/* ── Mode picker ── */}
      {screen === 'mode-picker' && (
        <>
          <div className="test-header">
            <h1>Test Mode</h1>
            <p>Exam conditions — no hints, no reference answers. Results are saved to your analytics.</p>
          </div>

          {loadingQuestions ? (
            <div className="test-loading">
              <div className="loading-spinner" />
              <p>Loading questions...</p>
            </div>
          ) : (
            <div className="mode-grid">
              {(Object.keys(MODE_CONFIG) as TestMode[]).map(m => {
                const cfg = MODE_CONFIG[m]
                const count = filterByMode(allQuestions, m).length
                return (
                  <button
                    key={m}
                    className="mode-card"
                    onClick={() => handleModeSelect(m)}
                    disabled={count === 0}
                  >
                    <span className="mode-emoji">{cfg.emoji}</span>
                    <span className="mode-label">{cfg.label}</span>
                    <span className="mode-desc">{cfg.description}</span>
                    <span className="mode-count">{count} question{count !== 1 ? 's' : ''} available</span>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Count picker ── */}
      {screen === 'count-picker' && selectedMode && (
        <div className="count-picker">
          <button className="back-btn" onClick={() => setScreen('mode-picker')}>← Back</button>
          <h2>{MODE_CONFIG[selectedMode].emoji} {MODE_CONFIG[selectedMode].label}</h2>
          <p>How many questions do you want?</p>
          <div className="count-grid">
            {COUNT_OPTIONS.map(c => {
              const available = filterByMode(allQuestions, selectedMode).length
              const actual = c === 0 ? available : Math.min(c, available)
              return (
                <button
                  key={c}
                  className={`count-card ${selectedCount === c ? 'selected' : ''}`}
                  onClick={() => handleCountSelect(c)}
                  disabled={available === 0}
                >
                  <span className="count-number">{c === 0 ? 'All' : c}</span>
                  {c !== 0 && <span className="count-sub">{actual} available</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Marcus intro ── */}
      {screen === 'intro' && selectedMode && (
        <div className="intro-card">
          <div className="intro-avatar">🤖</div>
          <h2>Hi {userName?.split(' ')[0] || 'there'}, I'm Marcus.</h2>
          <p className="intro-text">
            I'll be your interviewer today. You've chosen <strong>{MODE_CONFIG[selectedMode].label}</strong> mode
            with <strong>{queue.length} question{queue.length !== 1 ? 's' : ''}</strong>.
          </p>
          <p className="intro-text">
            Answer each question as you would in a real interview — no hints, no reference answers.
            Take your time, be specific, and use real examples where you can.
          </p>
          <p className="intro-text intro-ready">When you're ready, let's begin.</p>
          <button className="btn btn-primary intro-btn" onClick={handleBegin}>
            Start Interview
          </button>
        </div>
      )}

      {/* ── Active question ── */}
      {screen === 'question' && currentQ && (
        <div className="test-session">
          <div className="test-session-header">
            <div className="test-progress">
              <span className="test-mode-badge">{MODE_CONFIG[selectedMode!].emoji} {MODE_CONFIG[selectedMode!].label}</span>
              <span className="test-progress-text">
                {qIndex + 1} / {queue.length}
              </span>
            </div>
            <div className="test-session-right">
              <span className="session-timer">⏱ {formatTime(elapsed)}</span>
              <button className="btn btn-small" onClick={handleRestart}>Exit</button>
            </div>
          </div>

          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${(qIndex / queue.length) * 100}%` }}
            />
          </div>

          <div className="question-display-test">
            <div className="question-meta-row">
              <span className={`difficulty difficulty-${currentQ.difficulty.toLowerCase()}`}>
                {currentQ.difficulty}
              </span>
              <span className="category-badge">{currentQ.category}</span>
            </div>
            <h2>{currentQ.question_text}</h2>
          </div>

          {!evaluation && (
            <>
              {isCodingQuestion(currentQ) ? (
                <div className="monaco-wrapper">
                  <div className="monaco-toolbar">
                    <div className="lang-picker">
                      {LANGUAGES.map(lang => (
                        <button
                          key={lang.monacoId}
                          className={`lang-btn ${selectedLang.monacoId === lang.monacoId ? 'lang-btn-active' : ''}`}
                          onClick={() => handleLangChange(lang)}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Editor
                    height="360px"
                    language={selectedLang.monacoId}
                    value={codeAnswer}
                    onChange={val => setCodeAnswer(val || '')}
                    theme={theme === 'dark' ? 'vs-dark' : 'light'}
                    options={{
                      fontSize: 14,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      lineNumbers: 'on',
                      renderLineHighlight: 'all',
                      padding: { top: 12, bottom: 12 },
                    }}
                  />
                </div>
              ) : (
                <div className="answer-area">
                  <label htmlFor="test-answer" className="answer-label">Your Answer</label>
                  <textarea
                    id="test-answer"
                    value={textAnswer}
                    onChange={e => setTextAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    rows={10}
                    disabled={submitting}
                  />
                </div>
              )}

              <button
                className="btn btn-primary submit-btn"
                onClick={handleSubmit}
                disabled={submitting || !(isCodingQuestion(currentQ) ? codeAnswer.trim() : textAnswer.trim())}
              >
                {submitting ? '🤖 Marcus is evaluating...' : 'Submit Answer'}
              </button>
            </>
          )}

          {evaluation && (
            <div className="evaluation-results test-evaluation">
              <div className="evaluation-header">
                <h3>Marcus's Feedback</h3>
                <div className={`score-badge-lg ${evaluation.score >= 70 ? 'score-good' : evaluation.score >= 50 ? 'score-mid' : 'score-low'}`}>
                  {evaluation.score}<span>/100</span>
                </div>
              </div>

              <div className={`correctness ${evaluation.is_correct ? 'correct' : 'incorrect'}`}>
                {evaluation.is_correct ? '✅ Correct approach' : '⚠️ Needs improvement'}
              </div>

              <div className="feedback-section">
                <h4>💪 Strengths</h4>
                <ul>{evaluation.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>

              <div className="feedback-section">
                <h4>🎯 Areas for Improvement</h4>
                <ul>{evaluation.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>

              <div className="feedback-section">
                <h4>💡 Suggestions</h4>
                <ul>{evaluation.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>

              <div className="marcus-comment">
                <h4>🤖 Marcus says:</h4>
                <p>{evaluation.marcus_comment}</p>
              </div>

              <button className="btn btn-primary next-btn" onClick={handleNext}>
                {qIndex + 1 < queue.length ? 'Next Question →' : 'Finish Session'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Session complete ── */}
      {screen === 'complete' && (
        <div className="session-complete">
          <div className="session-complete-icon">🎉</div>
          <h2>Session Complete</h2>
          <p>{sessionScores.length} question{sessionScores.length !== 1 ? 's' : ''} answered &nbsp;·&nbsp; {formatTime(elapsed)}</p>

          {sessionAvg !== null && (
            <div className="session-avg">
              <span className="session-avg-label">Session Average</span>
              <span className="session-avg-score">{sessionAvg}<span>/100</span></span>
            </div>
          )}

          {selectedMode && sessionScores.length > 0 && (
            <div className="marcus-summary">
              <span className="marcus-summary-label">🤖 Marcus</span>
              <p>{getMarcusSummary(userName, sessionScores)}</p>
            </div>
          )}

          <p className="session-saved-note">Results saved to your dashboard analytics.</p>

          <div className="session-actions">
            <button className="btn btn-primary" onClick={() => { setSelectedMode(null); setScreen('mode-picker') }}>
              New Session
            </button>
            <button className="btn" onClick={() => { setQIndex(0); setSessionScores([]); setElapsed(0); handleCountSelect(selectedCount) }}>
              Retry Same Mode
            </button>
          </div>
        </div>
      )}
    </div>
  )
}