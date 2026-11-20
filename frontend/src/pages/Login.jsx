import { useState } from 'react'
import { loginUser } from '../services/authService.js'

function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const user = await loginUser(email.trim(), password)
      onLogin(user)
    } catch (loginError) {
      setError(loginError.message || 'Unable to sign in. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-label="University workflow information">
        <div className="story-glow story-glow-one" />
        <div className="story-glow story-glow-two" />
        <header className="brand-lockup">
          <img className="brand-mark" src="/brand-mark.svg" alt="" aria-hidden="true" />
          <span className="brand-name">Edu<span>Flow</span></span>
        </header>

        <div className="story-content">
          <div className="story-kicker"><span /> EDUFLOW · UNIVERSITY WORKFLOW, SIMPLIFIED</div>
          <h1>Make room for<br /><span>what matters.</span></h1>
          <p>One calm place to manage requests, coordinate meetings, and keep campus work moving.</p>

          <div className="workflow-preview" aria-hidden="true">
            <div className="preview-topline">
              <span className="preview-dot" />
              <span className="preview-dot" />
              <span className="preview-dot" />
              <span className="preview-label">WORKFLOW OVERVIEW</span>
              <span className="preview-date">TODAY</span>
            </div>
            <div className="preview-row">
              <span className="preview-icon preview-icon-violet">
                <svg viewBox="0 0 24 24" fill="none"><path d="M7 3v3m10-3v3M4.5 9h15M6 5h12a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 6 5Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <span className="preview-row-copy"><strong>Meeting request</strong><small>Department of Sciences</small></span>
              <span className="preview-status">IN REVIEW</span>
            </div>
            <div className="preview-row">
              <span className="preview-icon preview-icon-teal">
                <svg viewBox="0 0 24 24" fill="none"><path d="M7 3.75h7l4 4v12.5H7a2 2 0 0 1-2-2v-12a2.5 2.5 0 0 1 2-2.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M14 4v4h4M8.5 13h7m-7 3h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </span>
              <span className="preview-row-copy"><strong>Faculty document</strong><small>Academic Affairs</small></span>
              <span className="preview-status preview-status-ready">READY</span>
            </div>
            <div className="preview-footer"><span className="footer-check">✓</span> A little more clarity in every step</div>
          </div>
        </div>

        <footer className="story-footer">
          <span>BUILT FOR BETTER CAMPUS COLLABORATION</span>
          <span className="footer-separator" />
          <span>SECURE INSTITUTIONAL ACCESS</span>
        </footer>
      </section>

      <section className="login-panel">
        <div className="login-form-wrap">
          <div className="mobile-brand brand-lockup">
            <img className="brand-mark" src="/brand-mark.svg" alt="" aria-hidden="true" />
            <span className="brand-name">Edu<span>Flow</span></span>
          </div>

          <div className="form-heading">
            <span className="form-eyebrow">WELCOME BACK</span>
            <h2>Sign in to your account</h2>
            <p>Enter your university credentials to continue.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="email">University email</label>
            <div className="input-wrap">
              <svg className="input-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="m5 7 7 5.5L19 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <input
                autoComplete="username"
                id="email"
                name="email"
                type="email"
                placeholder="name@university.edu"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="password-label-row">
              <label htmlFor="password">Password</label>
            </div>
            <div className="input-wrap">
              <svg className="input-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="5" y="10" width="14" height="10" rx="2.2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                autoComplete="current-password"
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            {error && <div className="login-error" role="alert">{error}</div>}

            <button className="submit-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <><span className="button-spinner" aria-hidden="true" /> Signing in...</>
              ) : (
                <>Sign in <span aria-hidden="true">→</span></>
              )}
            </button>
          </form>

          <div className="secure-note">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3 19 6v5c0 4.7-3 8-7 10-4-2-7-5.3-7-10V6l7-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Your credentials are protected with secure authentication.</span>
          </div>

          <p className="support-note">Need access? Contact your university system administrator.</p>
        </div>

        <footer className="login-footer">
          <span>© {new Date().getFullYear()} EduFlow</span>
          <span>University workflow, made simple</span>
        </footer>
      </section>
    </main>
  )
}

export default Login