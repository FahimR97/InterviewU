import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { resetPassword, confirmResetPassword } from 'aws-amplify/auth'
import './Login.css'

export default function ForgotPassword() {
  const [step, setStep] = useState<'request' | 'confirm'>('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await resetPassword({ username: email })
      setStep('confirm')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send reset code.')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await confirmResetPassword({ username: email, confirmationCode: code, newPassword })
      navigate('/login', { state: { message: 'Password reset successfully. Please sign in.' } })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-brand">
        <Link to="/" className="login-brand-link">InterviewU</Link>
        <p>Ace your next technical interview</p>
      </div>
      <div className="login-card">
        <h2>Reset Password</h2>

        {step === 'request' ? (
          <>
            <p>Enter your email and we'll send you a reset code.</p>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleRequest}>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="your@email.com"
                  disabled={loading}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? 'Sending…' : 'Send Reset Code'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p>Check your email for the code we sent to <strong>{email}</strong>.</p>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleConfirm}>
              <div className="form-group">
                <label htmlFor="code">Reset Code</label>
                <input
                  type="text"
                  id="code"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  required
                  placeholder="123456"
                  disabled={loading}
                  autoComplete="one-time-code"
                />
              </div>
              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>
            </form>
            <p className="login-footer">
              <button className="link-button" onClick={() => { setStep('request'); setError('') }}>
                Re-send code
              </button>
            </p>
          </>
        )}

        <p className="login-footer">
          <Link to="/login" className="link">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}