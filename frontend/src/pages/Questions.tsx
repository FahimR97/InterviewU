import { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Questions.css';

interface Question {
  id: string;
  title: string;
  description: string;
  tags: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: string;
}

// Mock data for testing
const mockQuestions: Question[] = [
  {
    id: '1',
    title: 'Explain the OSI Model',
    description: 'Describe each layer of the OSI model and its purpose in networking.',
    tags: ['Networking', 'Fundamentals'],
    difficulty: 'Easy',
    category: 'Networking'
  },
  {
    id: '2',
    title: 'What is TCP vs UDP?',
    description: 'Compare and contrast TCP and UDP protocols. When would you use each?',
    tags: ['Networking', 'Protocols'],
    difficulty: 'Medium',
    category: 'Networking'
  },
  {
    id: '3',
    title: 'Implement a Binary Search Tree',
    description: 'Design and implement a binary search tree with insert, delete, and search operations.',
    tags: ['Data Structures', 'Algorithms'],
    difficulty: 'Hard',
    category: 'Algorithms'
  },
  {
    id: '4',
    title: 'What is a RESTful API?',
    description: 'Explain REST principles and best practices for designing RESTful APIs.',
    tags: ['API', 'Web Development'],
    difficulty: 'Easy',
    category: 'Web Development'
  },
  {
    id: '5',
    title: 'Design a URL Shortener',
    description: 'Design a system like bit.ly that can shorten URLs and redirect users.',
    tags: ['System Design', 'Scalability'],
    difficulty: 'Hard',
    category: 'System Design'
  }
];

export default function Questions() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const { user } = useAuth();

  const categories = useMemo(() => {
    const cats = new Set(mockQuestions.map(q => q.category));
    return ['All', ...Array.from(cats)];
  }, []);

  const difficulties = ['All', 'Easy', 'Medium', 'Hard'];

  const filteredQuestions = useMemo(() => {
    return mockQuestions.filter(question => {
      const matchesSearch = question.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           question.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           question.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCategory = selectedCategory === 'All' || question.category === selectedCategory;
      const matchesDifficulty = selectedDifficulty === 'All' || question.difficulty === selectedDifficulty;

      return matchesSearch && matchesCategory && matchesDifficulty;
    });
  }, [searchTerm, selectedCategory, selectedDifficulty]);

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
            : '⚠️ Please login to access protected API features'}
        </p>
        {user && <span className="auth-badge">✓ Authenticated</span>}
      </header>

      <div className="filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search questions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Category:</label>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Difficulty:</label>
          <select value={selectedDifficulty} onChange={(e) => setSelectedDifficulty(e.target.value)}>
            {difficulties.map(diff => (
              <option key={diff} value={diff}>{diff}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="questions-list">
        {filteredQuestions.length === 0 ? (
          <p className="no-results">No questions found matching your filters.</p>
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
        Showing {filteredQuestions.length} of {mockQuestions.length} questions
      </div>
    </div>
  );
}
