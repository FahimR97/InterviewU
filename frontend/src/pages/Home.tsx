import { Link } from 'react-router-dom';
import './Home.css';

export default function Home() {
  return (
    <div className="home-container">
      <h1>Interview Question Bank</h1>
      <p>Search, filter, and manage technical interview questions</p>
      <div className="home-actions">
        <Link to="/questions" className="btn btn-primary">
          Browse Questions
        </Link>
        <Link to="/login" className="btn btn-secondary">
          Login
        </Link>
      </div>
    </div>
  );
}
