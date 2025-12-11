import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

export default function VerifyEmail() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyEmail, resendVerificationCode } = useAuth();

  useEffect(() => {
    const emailFromState = location.state?.email;
    if (emailFromState) {
      setEmail(emailFromState);
    }
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      await verifyEmail(email, code);
      navigate('/login', {
        state: { message: 'Email verified! You can now login.' }
      });
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.message || 'Failed to verify email. Please check your code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setSuccess('');

    if (!email) {
      setError('Please enter your email address first');
      return;
    }

    try {
      await resendVerificationCode(email);
      setSuccess('Verification code resent! Check your email.');
    } catch (err: any) {
      console.error('Resend error:', err);
      setError(err.message || 'Failed to resend code.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Verify Your Email</h2>
        <p>Enter your email and the verification code sent to you</p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="code">Verification Code</label>
            <input
              type="text"
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              placeholder="123456"
              disabled={loading}
              maxLength={6}
              style={{ fontSize: '1.5rem', textAlign: 'center', letterSpacing: '0.5rem' }}
            />
            <small className="form-hint">
              Check your email for a 6-digit code
            </small>
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>

        <p className="login-note">
          📧 Didn't receive the code? Check your spam folder or{' '}
          <button
            type="button"
            onClick={handleResendCode}
            className="link-button"
          >
            resend code
          </button>
        </p>
      </div>
    </div>
  );
}
