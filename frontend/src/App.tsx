import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Questions from './pages/Questions';
import Signup from './pages/Signup';
import ChangePassword from './pages/ChangePassword';
import './App.css';

function NavBar() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          Interview Question Bank
        </Link>
        <div className="navbar-links">
          <Link to="/questions" className="nav-link">
            Questions
          </Link>
          {user ? (
            <>
              <span className="user-email">
                {user.signInDetails?.loginId || user.username}
              </span>
              <button onClick={handleLogout} className="nav-link nav-button logout-btn">
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="nav-link">
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

function AppContent() {
  return (
    <BrowserRouter>
      <div className="app">
        <NavBar />

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/questions" element={<Questions />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/change-password" element={<ChangePassword />} />
          </Routes>
        </main>

        <footer className="footer">
          <p>&copy; 2024 Interview Question Bank. Built with React + TypeScript + Vite</p>
        </footer>
      </div>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
