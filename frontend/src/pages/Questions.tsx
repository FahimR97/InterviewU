import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAllQuestions } from '../services/api';
import type { Question } from '../services/api';
import './Questions.css';

export default function Questions() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, getAuthToken } = useAuth();

  useEffect(() => {
    loadQuestions();
  }, [user]);

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

  const categories = useMemo(() => {
    const cats = new Set(questions.map(q => q.category));
    return ['All', ...Array.from(cats)];
  }, [questions]);

  const difficulties = ['All', 'Easy', 'Medium', 'Hard'];

  const filteredQuestions = useMemo(() => {
    return questions.filter(question => {
      const matchesSearch = question.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           question.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           question.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCategory = selectedCategory === 'All' || question.category === selectedCategory;
      const matchesDifficulty = selectedDifficulty === 'All' || question.difficulty === selectedDifficulty;

      return matchesSearch && matchesCategory && matchesDifficulty;
    });
  }, [questions, searchTerm, selectedCategory, selectedDifficulty]);

  const getDifficultyClass = (difficulty: string) => {
    return `difficulty difficulty-${difficulty.toLowerCase()}`;
  };

  return (
    <div className="questions-container">
      <header className="questions-header">
        <h1>Question Bank</h1>
        <p>
          {user
            ? 'Browse and search technical interview questions'
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
                  <option key={diff} value={diff}>{diff}</option>
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
                        <h3>{question.title}</h3>
                        <span className={getDifficultyClass(question.difficulty)}>
                          {question.difficulty}
                        </span>
                      </div>
                      <p className="question-description">{question.description}</p>
                      <div className="question-footer">
                        <div className="question-tags">
                          {question.tags.map(tag => (
                            <span key={tag} className="tag">{tag}</span>
                          ))}
                        </div>
                        <button className="btn btn-small">View Details</button>
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
    </div>
  );
}
