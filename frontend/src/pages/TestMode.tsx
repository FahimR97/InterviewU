import { useState, useEffect, useRef, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { getAllQuestions, evaluateAnswer } from '../services/api'
import type { Question, EvaluationResponse } from '../services/api'
import './TestMode.css'

type TestMode = 'behavioural' | 'coding' | 'system_design' | 'networking' | 'linux' | 'full'
type Screen = 'mode-picker' | 'count-picker' | 'intro' | 'question' | 'evaluating' | 'complete'

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
  counts: number[] // 0 = all
}

const MODE_CONFIG: Record<TestMode, ModeConfig> = {
  behavioural: {
    label: 'Behavioural',
    description: 'Competency and situational questions',
    emoji: '🧠',
    categories: ['behavioural', 'behavioral', 'leadership', 'soft skills', 'competency'],
    counts: [5, 10, 15, 0],
  },
  coding: {
    label: 'Coding',
    description: 'Technical coding and algorithms',
    emoji: '💻',
    categories: ['coding', 'programming', 'algorithms', 'data structures'],
    counts: [5, 10, 15, 0],
  },
  system_design: {
    label: 'System Design',
    description: 'Architecture and scalability',
    emoji: '🏗️',
    categories: ['system design', 'architecture', 'design'],
    counts: [3, 5, 10, 0],
  },
  networking: {
    label: 'Networking',
    description: 'TCP/IP, DNS, HTTP, protocols',
    emoji: '🌐',
    categories: ['networking', 'network', 'tcp', 'dns', 'http', 'protocol'],
    counts: [5, 10, 0],
  },
  linux: {
    label: 'Linux',
    description: 'Linux, shell, OS fundamentals',
    emoji: '🐧',
    categories: ['linux', 'unix', 'bash', 'shell', 'kernel', 'operating system'],
    counts: [5, 10, 0],
  },
  full: {
    label: 'Full Interview',
    description: 'Mixed questions across all topics',
    emoji: '🎯',
    categories: [],
    // Real AWS/FAANG loops: 4-6 rounds, 2 questions each = 8-12 questions
    counts: [5, 8, 12],
  },
}

interface StoredAnswer {
  text: string
  code: string
  lang: LangOption
}

interface QuestionResult {
  question: Question
  answer: string
  evaluation: EvaluationResponse
}

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
  return `You averaged ${avg}/100, ${firstName}. There's real work to do here, but that's exactly what this is for. Go through the feedback on each answer and focus on the weak areas before your next session.`
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

  // Per-question answer state
  const [textAnswer, setTextAnswer] = useState('')
  const [selectedLang, setSelectedLang] = useState<LangOption>(LANGUAGES[0])
  const [codeAnswer, setCodeAnswer] = useState(LANGUAGES[0].starter)

  // Stored answers for all questions (collected before evaluation)
  const [answers, setAnswers] = useState<StoredAnswer[]>([])
  // Results after batch evaluation
  const [results, setResults] = useState<QuestionResult[]>([])
  const [evalProgress, setEvalProgress] = useState(0)
  const [sessionScores, setSessionScores] = useState<number[]>([])
  // Which result card is expanded in the complete screen
  const [expandedResult, setExpandedResult] = useState<number | null>(null)

  // Stopwatch
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoadingQuestions(true)
      try {
        const token = await getAuthToken()
        const data = await getAllQuestions(token)
        setAllQuestions(data)
      } catch (err) {
        console.error('Failed to load questions:', err)
      } finally {
        setLoadingQuestions(false)
      }
    }
    load()
  }, [user, getAuthToken])

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
    setAnswers([])
    setResults([])
    setSessionScores([])
    setEvalProgress(0)
    setElapsed(0)
    setExpandedResult(null)
    setScreen('intro')
  }

  const handleBegin = () => {
    setTextAnswer('')
    setSelectedLang(LANGUAGES[0])
    setCodeAnswer(LANGUAGES[0].starter)
    setScreen('question')
  }

  const handleLangChange = (lang: LangOption) => {
    setSelectedLang(lang)
    setCodeAnswer(lang.starter)
  }

  // Save current answer and advance (or trigger evaluation if last question)
  const handleEvaluateAll = useCallback(async (storedAnswers: StoredAnswer[]) => {
    setScreen('evaluating')
    const newResults: QuestionResult[] = []
    const newScores: number[] = []

    for (let i = 0; i < queue.length; i++) {
      setEvalProgress(i + 1)
      const q = queue[i]
      const ans = storedAnswers[i]
      const answer = isCodingQuestion(q) ? ans.code : ans.text
      try {
        const token = await getAuthToken()
        const result = await evaluateAnswer(
          {
            question: q.question_text,
            answer,
            competency_type: q.competency,
            question_id: q.id,
            category: q.category,
            difficulty: q.difficulty,
            mode: 'test',
          },
          token
        )
        newResults.push({ question: q, answer, evaluation: result })
        newScores.push(result.score)
      } catch (err) {
        console.error(`Failed to evaluate Q${i + 1}:`, err)
      }
    }

    setResults(newResults)
    setSessionScores(newScores)
    setScreen('complete')
  }, [queue, getAuthToken])

  const handleSaveAndNext = () => {
    const newAnswers = [...answers]
    newAnswers[qIndex] = { text: textAnswer, code: codeAnswer, lang: selectedLang }
    setAnswers(newAnswers)

    if (qIndex + 1 < queue.length) {
      const nextIdx = qIndex + 1
      setQIndex(nextIdx)
      // Restore previously saved answer if revisiting
      if (newAnswers[nextIdx]) {
        setTextAnswer(newAnswers[nextIdx].text)
        setCodeAnswer(newAnswers[nextIdx].code)
        setSelectedLang(newAnswers[nextIdx].lang)
      } else {
        setTextAnswer('')
        setSelectedLang(LANGUAGES[0])
        setCodeAnswer(LANGUAGES[0].starter)
      }
    } else {
      handleEvaluateAll(newAnswers)
    }
  }

  const handleRestart = () => {
    setScreen('mode-picker')
    setSelectedMode(null)
    setQueue([])
    setQIndex(0)
    setAnswers([])
    setResults([])
    setSessionScores([])
    setElapsed(0)
    setEvalProgress(0)
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
  const currentAnswer = isCodingQuestion(currentQ ?? queue[0]) ? codeAnswer : textAnswer
  const hasAnswer = currentAnswer.trim().length > 0 &&
    currentAnswer !== (selectedLang.starter).trim()

  return (
    <div className="test-container">

      {/* ── Mode picker ── */}
      {screen === 'mode-picker' && (
        <>
          <div className="test-header">
            <h1>Test Mode</h1>
            <p>Exam conditions — no hints, no reference answers. All answers are evaluated together at the end.</p>
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
          {selectedMode === 'full' && (
            <p className="count-note">A real AWS or FAANG loop typically has 8–12 questions across multiple rounds.</p>
          )}
          <p>How many questions?</p>
          <div className="count-grid">
            {MODE_CONFIG[selectedMode].counts.map(c => {
              const available = filterByMode(allQuestions, selectedMode).length
              const actual = c === 0 ? available : Math.min(c, available)
              return (
                <button
                  key={c}
                  className={`count-card ${selectedCount === c ? 'selected' : ''}`}
                  onClick={() => handleCountSelect(c)}
                  disabled={available === 0 || actual === 0}
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
            I'll evaluate all your answers together at the end and give you detailed feedback on each one.
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
              <span className="test-progress-text">{qIndex + 1} / {queue.length}</span>
            </div>
            <div className="test-session-right">
              <span className="session-timer">⏱ {formatTime(elapsed)}</span>
              <button className="btn btn-small" onClick={handleRestart}>Exit</button>
            </div>
          </div>

          {/* Question progress dots */}
          <div className="question-dots">
            {queue.map((_, i) => (
              <span
                key={i}
                className={`q-dot ${i === qIndex ? 'q-dot-current' : answers[i] ? 'q-dot-done' : 'q-dot-empty'}`}
                title={`Question ${i + 1}${answers[i] ? ' (answered)' : ''}`}
              />
            ))}
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
              />
            </div>
          )}

          <button
            className="btn btn-primary submit-btn"
            onClick={handleSaveAndNext}
            disabled={!hasAnswer}
          >
            {qIndex + 1 < queue.length ? 'Next Question →' : '🤖 Submit for Evaluation'}
          </button>
        </div>
      )}

      {/* ── Evaluating ── */}
      {screen === 'evaluating' && (
        <div className="evaluating-screen">
          <div className="evaluating-avatar">🤖</div>
          <h2>Marcus is reviewing your answers…</h2>
          <p className="evaluating-sub">
            Evaluating question {evalProgress} of {queue.length}
          </p>
          <div className="eval-progress-track">
            <div
              className="eval-progress-fill"
              style={{ width: `${(evalProgress / queue.length) * 100}%` }}
            />
          </div>
          <p className="evaluating-note">This takes a few seconds per answer. Hang tight.</p>
        </div>
      )}

      {/* ── Session complete ── */}
      {screen === 'complete' && (
        <div className="session-complete">
          <div className="session-complete-header">
            <div className="session-complete-icon">🎉</div>
            <h2>Interview Complete</h2>
            <p>{sessionScores.length} question{sessionScores.length !== 1 ? 's' : ''} &nbsp;·&nbsp; {formatTime(elapsed)}</p>
          </div>

          {sessionAvg !== null && (
            <div className="session-avg">
              <span className="session-avg-label">Session Average</span>
              <span className={`session-avg-score ${sessionAvg >= 70 ? 'score-good' : sessionAvg >= 50 ? 'score-mid' : 'score-low'}`}>
                {sessionAvg}<span>/100</span>
              </span>
            </div>
          )}

          {selectedMode && sessionScores.length > 0 && (
            <div className="marcus-summary">
              <span className="marcus-summary-label">🤖 Marcus</span>
              <p>{getMarcusSummary(userName, sessionScores)}</p>
            </div>
          )}

          {/* Per-question results */}
          <div className="results-list">
            <h3 className="results-list-title">Question by Question</h3>
            {results.map((r, i) => {
              const isOpen = expandedResult === i
              const ev = r.evaluation
              return (
                <div key={i} className={`result-item ${isOpen ? 'result-item-open' : ''}`}>
                  <button
                    className="result-item-header"
                    onClick={() => setExpandedResult(isOpen ? null : i)}
                  >
                    <span className="result-item-num">Q{i + 1}</span>
                    <span className="result-item-q">{r.question.question_text}</span>
                    <span className={`result-item-score ${ev.score >= 70 ? 'score-good' : ev.score >= 50 ? 'score-mid' : 'score-low'}`}>
                      {ev.score}/100
                    </span>
                    <span className="result-item-chevron">{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {isOpen && (
                    <div className="result-item-body">
                      <div className={`correctness ${ev.is_correct ? 'correct' : 'incorrect'}`}>
                        {ev.is_correct ? '✅ Correct approach' : '⚠️ Needs improvement'}
                      </div>

                      <div className="feedback-section">
                        <h4>💪 Strengths</h4>
                        <ul>{ev.strengths.map((s, j) => <li key={j}>{s}</li>)}</ul>
                      </div>

                      <div className="feedback-section">
                        <h4>🎯 Areas for Improvement</h4>
                        <ul>{ev.improvements.map((s, j) => <li key={j}>{s}</li>)}</ul>
                      </div>

                      <div className="feedback-section">
                        <h4>💡 Suggestions</h4>
                        <ul>{ev.suggestions.map((s, j) => <li key={j}>{s}</li>)}</ul>
                      </div>

                      <div className="marcus-comment">
                        <h4>🤖 Marcus says:</h4>
                        <p>{ev.marcus_comment}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <p className="session-saved-note">Results saved to your dashboard analytics.</p>

          <div className="session-actions">
            <button className="btn btn-primary" onClick={handleRestart}>New Session</button>
            <button className="btn" onClick={() => handleCountSelect(selectedCount)}>Retry Same Mode</button>
          </div>
        </div>
      )}
    </div>
  )
}