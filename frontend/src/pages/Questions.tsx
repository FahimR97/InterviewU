import { useState, useMemo, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getAllQuestions, evaluateAnswer } from '../services/api';
import type { Question, EvaluationResponse } from '../services/api';
import './Questions.css';

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

export default function Questions() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, getAuthToken } = useAuth();
  const { theme } = useTheme();

  // Answer modal state
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [selectedLang, setSelectedLang] = useState<LangOption>(LANGUAGES[0]);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);

  const loadQuestions = async () => {
    if (!user) {
      setLoading(false);
      setQuestions([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = await getAuthToken();
      const data = await getAllQuestions(token);
      setQuestions(data);
    } catch (err) {
      console.error('Error loading questions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const categories = useMemo(() => {
    const cats = new Set(questions.map(q => q.category));
    return ['All', ...Array.from(cats)];
  }, [questions]);

  const difficulties = useMemo(() => {
    const diffs = new Set(questions.map(q => q.difficulty.toLowerCase()));
    return ['All', ...Array.from(diffs)];
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    return questions.filter(question => {
      const matchesSearch = question.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           question.difficulty.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           question.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = selectedCategory === 'All' || question.category === selectedCategory;
      const matchesDifficulty = selectedDifficulty === 'All' ||
                                question.difficulty.toLowerCase() === selectedDifficulty.toLowerCase();

      return matchesSearch && matchesCategory && matchesDifficulty;
    });
  }, [questions, searchTerm, selectedCategory, selectedDifficulty]);

  const getDifficultyClass = (difficulty: string) => {
    return `difficulty difficulty-${difficulty.toLowerCase()}`;
  };

  const capitalizeCategory = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  };

  const capitalizeDifficulty = (difficulty: string) => {
    return difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
  };

  const handlePracticeAnswer = (question: Question) => {
    setSelectedQuestion(question);
    setUserAnswer('');
    setSelectedLang(LANGUAGES[0]);
    setEvaluation(null);
  };

  const handleCloseModal = () => {
    setSelectedQuestion(null);
    setUserAnswer('');
    setSelectedLang(LANGUAGES[0]);
    setEvaluation(null);
  };

  const handleLangChange = (lang: LangOption) => {
    setSelectedLang(lang);
    setUserAnswer(lang.starter);
  };

  const handleSubmitAnswer = async () => {
    if (!selectedQuestion || !userAnswer.trim()) {
      return;
    }

    try {
      setEvaluating(true);
      const token = await getAuthToken();
      const result = await evaluateAnswer(
        {
          question: selectedQuestion.question_text,
          answer: userAnswer,
          competency_type: selectedQuestion.competency,
          question_id: selectedQuestion.id,
          category: selectedQuestion.category,
          difficulty: selectedQuestion.difficulty,
          mode: 'practice',
        },
        token
      );
      setEvaluation(result);
    } catch (err) {
      console.error('Error evaluating answer:', err);
      alert(err instanceof Error ? err.message : 'Failed to evaluate answer');
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="questions-container">
      <header className="questions-header">
        <h1>Question Bank</h1>
        <p>
          {user
            ? 'Browse and practice technical interview questions with AI feedback'
            : '⚠️ Please login to access the question bank'}
        </p>
        {user && <span className="auth-badge">✓ Authenticated</span>}
      </header>

      {!user && (
        <div className="warning-box">
          <p>You need to be logged in to view questions. Please sign in or create an account.</p>
        </div>
      )}

      {user && (
        <>
          <div className="filters">
            <div className="search-box">
              <input
                type="text"
                placeholder="Search questions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="filter-group">
              <label>Category:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                disabled={loading}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Difficulty:</label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                disabled={loading}
              >
                {difficulties.map(diff => (
                  <option key={diff} value={diff}>{capitalizeDifficulty(diff)}</option>
                ))}
              </select>
            </div>

            <button
              className="btn btn-small"
              onClick={loadQuestions}
              disabled={loading}
            >
              {loading ? 'Loading...' : '🔄 Refresh'}
            </button>
          </div>

          {loading && (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading questions...</p>
            </div>
          )}

          {error && (
            <div className="error-box">
              <p>❌ Error: {error}</p>
              <button className="btn" onClick={loadQuestions}>Retry</button>
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="questions-list">
                {filteredQuestions.length === 0 ? (
                  <p className="no-results">
                    {questions.length === 0
                      ? 'No questions available yet. Add some questions to get started!'
                      : 'No questions found matching your filters.'}
                  </p>
                ) : (
                  filteredQuestions.map(question => (
                    <div key={question.id} className="question-card">
                      <div className="question-header">
                        <h3>{question.question_text}</h3>
                        <span className={getDifficultyClass(question.difficulty)}>
                          {capitalizeDifficulty(question.difficulty)}
                        </span>
                      </div>
                      <div className="question-footer">
                        <div className="question-tags">
                          <span className="tag">{capitalizeCategory(question.category)}</span>
                        </div>
                        <button
                          className="btn btn-small"
                          onClick={() => handlePracticeAnswer(question)}
                        >
                          🎯 Practice Answer
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="results-count">
                Showing {filteredQuestions.length} of {questions.length} questions
              </div>
            </>
          )}
        </>
      )}

      {/* Answer Modal */}
      {selectedQuestion && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Practice Answer</h2>
              <button className="modal-close" onClick={handleCloseModal}>✕</button>
            </div>

            <div className="modal-body">
              <div className="question-display">
                <h3>{selectedQuestion.question_text}</h3>
                <div className="question-meta">
                  <span className={getDifficultyClass(selectedQuestion.difficulty)}>
                    {capitalizeDifficulty(selectedQuestion.difficulty)}
                  </span>
                  <span className="category-badge">{capitalizeCategory(selectedQuestion.category)}</span>
                </div>
                {selectedQuestion.reference_answer && (
                  <details className="reference-answer">
                    <summary>📚 Reference Answer (click to reveal)</summary>
                    <p>{selectedQuestion.reference_answer}</p>
                  </details>
                )}
              </div>

              {isCodingQuestion(selectedQuestion) ? (
                <div className="practice-monaco-wrapper">
                  <div className="practice-monaco-toolbar">
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
                    height="300px"
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
                <div className="answer-section">
                  <label htmlFor="user-answer">Your Answer:</label>
                  <textarea
                    id="user-answer"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="Type your answer here..."
                    rows={8}
                    disabled={evaluating}
                  />
                </div>
              )}

              {!evaluation && (
                <button
                  className="btn btn-primary"
                  onClick={handleSubmitAnswer}
                  disabled={evaluating || !userAnswer.trim()}
                >
                  {evaluating ? '🤖 Marcus is evaluating...' : '✨ Get AI Feedback'}
                </button>
              )}

              {evaluation && (
                <div className="evaluation-results">
                  <div className="evaluation-header">
                    <h3>Marcus's Feedback</h3>
                    <div className="score-badge">
                      Score: {evaluation.score}/100
                    </div>
                  </div>

                  <div className={`correctness ${evaluation.is_correct ? 'correct' : 'incorrect'}`}>
                    {evaluation.is_correct ? '✅ Correct approach!' : '⚠️ Needs improvement'}
                  </div>

                  <div className="feedback-section">
                    <h4>💪 Strengths</h4>
                    <ul>
                      {evaluation.strengths.map((strength, idx) => (
                        <li key={idx}>{strength}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="feedback-section">
                    <h4>🎯 Areas for Improvement</h4>
                    <ul>
                      {evaluation.improvements.map((improvement, idx) => (
                        <li key={idx}>{improvement}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="feedback-section">
                    <h4>💡 Suggestions</h4>
                    <ul>
                      {evaluation.suggestions.map((suggestion, idx) => (
                        <li key={idx}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="marcus-comment">
                    <h4>🤖 Marcus says:</h4>
                    <p>{evaluation.marcus_comment}</p>
                  </div>

                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setUserAnswer('');
                      setEvaluation(null);
                    }}
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
