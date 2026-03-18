import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { fetchAuthSession } from 'aws-amplify/auth'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import Home from './pages/Home'
import Login from './pages/Login'
import Questions from './pages/Questions'
import Admin from './pages/Admin'
import Signup from './pages/Signup'
import ChangePassword from './pages/ChangePassword'
import Dashboard from './pages/Dashboard'
import TestMode from './pages/TestMode'
import './App.css'

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
    </button>
  )
}

function NavBar() {
  const { user, logout } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!user) return
    fetchAuthSession()
      .then(session => {
        const groups = (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) || []
        setIsAdmin(groups.includes('Admin'))
      })
      .catch(() => setIsAdmin(false))
  }, [user])

  const showAdmin = !!user && isAdmin

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          InterviewU
        </Link>
        <div className="navbar-links">
          {user && (
            <Link to="/dashboard" className="nav-link">
              Dashboard
            </Link>
          )}
          {user && (
            <Link to="/questions" className="nav-link">
              Practice
            </Link>
          )}
          {user && (
            <Link to="/test" className="nav-link">
              Test
            </Link>
          )}
          {showAdmin && (
            <Link to="/admin" className="nav-link">
              Admin
            </Link>
          )}
          <ThemeToggle />
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
  )
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
            <Route path="/admin" element={<Admin />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/test" element={<TestMode />} />
          </Routes>
        </main>

        <footer className="footer">
          <p>&copy; 2025 InterviewU &mdash; Powered by AWS</p>
        </footer>
      </div>
    </BrowserRouter>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
