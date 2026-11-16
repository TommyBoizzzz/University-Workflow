import { useEffect, useState } from 'react'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import { getCurrentUser, getStoredToken, signOut } from './services/authService.js'

function App() {
  const [user, setUser] = useState(null)
  const [isRestoringSession, setIsRestoringSession] = useState(true)

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
        <span className="loading-mark" aria-hidden="true">U</span>
        <p>Loading your workspace…</p>
      </main>
    )
  }

  if (!user) {
    return <Login onLogin={setUser} />
  }

  return (
    <Dashboard
      user={user}
      onUserUpdate={setUser}
      onSignOut={() => {
        signOut()
        setUser(null)
      }}
    />
  )
}

export default App
