import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import { useState, useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Questions from "./pages/Questions";
import Admin from "./pages/Admin";
import Signup from "./pages/Signup";
import ChangePassword from "./pages/ChangePassword";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import TestMode from "./pages/TestMode";
import "./App.css";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="theme-segment" role="group" aria-label="Color theme">
      <button
        className={`theme-seg-btn${theme === "light" ? " active" : ""}`}
        onClick={() => theme !== "light" && toggleTheme()}
        aria-pressed={theme === "light"}
      >
        Light
      </button>
      <button
        className={`theme-seg-btn${theme === "dark" ? " active" : ""}`}
        onClick={() => theme !== "dark" && toggleTheme()}
        aria-pressed={theme === "dark"}
      >
        Dark
      </button>
    </div>
  );
}

function NavBar() {
  const { user, logout } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();
  const onAdminPage = location.pathname.startsWith("/admin");

  useEffect(() => {
    if (!user) return;
    fetchAuthSession()
      .then((session) => {
        const groups =
          (session.tokens?.accessToken?.payload[
            "cognito:groups"
          ] as string[]) || [];
        setIsAdmin(groups.includes("Admin"));
      })
      .catch(() => setIsAdmin(false));
  }, [user]);

  const showAdmin = !!user && isAdmin;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <nav className={`navbar${user ? " navbar-sticky" : ""}`}>
      <div
        className={`navbar-container${onAdminPage ? " navbar-container--wide" : ""}`}
      >
        <Link to="/" className="navbar-brand">
          {onAdminPage ? "InterviewMe Admin" : "InterviewMe"}
        </Link>

        <div className="navbar-links">
          {showAdmin ? (
            <>
              <Link to="/admin" className="nav-link">
                Overview
              </Link>
              <Link to="/admin?tab=questions" className="nav-link">
                Questions
              </Link>
              <Link to="/admin?tab=users" className="nav-link">
                Users
              </Link>
              <span className="admin-nav-badge">Admin</span>
            </>
          ) : (
            <>
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
            </>
          )}
          {user ? (
            <>
              <span className="user-email">
                {user.signInDetails?.loginId || user.username}
              </span>
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="nav-link nav-button logout-btn"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <ThemeToggle />
              <Link to="/login" className="nav-link">
                Login
              </Link>
            </>
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
            <Route path="/forgot-password" element={<ForgotPassword />} />
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
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
