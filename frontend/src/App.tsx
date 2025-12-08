import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Questions from './pages/Questions';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="navbar">
          <div className="navbar-container">
            <Link to="/" className="navbar-brand">
              Interview Question Bank
            </Link>
            <div className="navbar-links">
              <Link to="/questions" className="nav-link">
                Questions
              </Link>
              <Link to="/login" className="nav-link">
                Login
              </Link>
            </div>
          </div>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/questions" element={<Questions />} />
          </Routes>
        </main>

        <footer className="footer">
          <p>&copy; 2024 Interview Question Bank. Built with React + TypeScript + Vite</p>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
