import { useEffect, useState } from 'react'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import { getCurrentUser, getStoredToken, signOut } from './services/authService.js'

function getInitialTheme() {
  const savedTheme = window.localStorage.getItem('eduflow-theme')
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function App() {
  const [user, setUser] = useState(null)
  const [isRestoringSession, setIsRestoringSession] = useState(true)
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('eduflow-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
  }

  useEffect(() => {
    let isMounted = true

    const restoreSession = async () => {
      if (!getStoredToken()) {
        setIsRestoringSession(false)
        return
      }

      try {
        const currentUser = await getCurrentUser()
        if (isMounted) setUser(currentUser)
      } catch {
        signOut()
      } finally {
        if (isMounted) setIsRestoringSession(false)
      }
    }

    restoreSession()

    return () => {
      isMounted = false
    }
  }, [])

  if (isRestoringSession) {
    return (
      <main className="session-loading" aria-label="Restoring your session">
        <img className="loading-mark" src="/brand-mark.svg" alt="" aria-hidden="true" />
        <p>Loading your workspace…</p>
      </main>
    )
  }

  if (!user) {
    return <Login onLogin={setUser} theme={theme} onToggleTheme={toggleTheme} />
  }

  return (
    <Dashboard
      user={user}
      theme={theme}
      onToggleTheme={toggleTheme}
      onUserUpdate={setUser}
      onSignOut={() => {
        signOut()
        setUser(null)
      }}
    />
  )
}

export default App
