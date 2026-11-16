import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createRequest,
  getRequests,
  reviewRequest,
} from '../services/requestService.js'
import {
  createManagedUser,
  getUserManagementData,
} from '../services/userService.js'
import './Dashboard.css'

const navigation = [
  { id: 'overview', label: 'Overview', icon: '◫' },
  { id: 'requests', label: 'Requests', icon: '↗' },
  { id: 'approvals', label: 'Approvals', icon: '✓', reviewersOnly: true },
  { id: 'documents', label: 'Documents', icon: '▤' },
  { id: 'calendar', label: 'Calendar', icon: '▦' },
  { id: 'users', label: 'Users', icon: '♙', adminsOnly: true },
]

const initialForm = { type: 'MEETING', title: '', topic: '', description: '' }
const initialUserForm = {
  fullName: '',
  email: '',
  password: '',
  role: '',
  departmentId: '',
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function Dashboard({ user, onSignOut }) {
  const [activePage, setActivePage] = useState('overview')
  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [workingRequestId, setWorkingRequestId] = useState(null)
  const [userDirectory, setUserDirectory] = useState({ users: [], roles: [], departments: [] })
  const [isUsersLoading, setIsUsersLoading] = useState(false)
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false)
  const [userForm, setUserForm] = useState(initialUserForm)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [createUserError, setCreateUserError] = useState('')
  const isTeacher = user.role === 'TEACHER'
  const canReview = ['MANAGER', 'ADMIN', 'SUPERADMIN'].includes(user.role)
  const canManageUsers = ['ADMIN', 'SUPERADMIN'].includes(user.role)

  const loadRequests = useCallback(async () => {
    setError('')
    setIsLoading(true)
    try {
      setRequests(await getRequests())
    } catch (loadError) {
      setError(loadError.message || 'Unable to load requests.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isActive = true

    getRequests()
      .then((loadedRequests) => {
        if (isActive) setRequests(loadedRequests)
      })
      .catch((loadError) => {
        if (isActive) setError(loadError.message || 'Unable to load requests.')
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [])

  const pendingCount = useMemo(
    () => requests.filter((request) => request.status === 'PENDING').length,
    [requests],
  )
  const approvedCount = useMemo(
    () => requests.filter((request) => request.status === 'APPROVED').length,
    [requests],
  )
  const recentRequests = requests.slice(0, 5)
  const visibleNavigation = navigation.filter(
    (item) => (!item.reviewersOnly || canReview) && (!item.adminsOnly || canManageUsers),
  )

  const handleCreateRequest = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await createRequest(form)
      setForm(initialForm)
      setIsCreateOpen(false)
      setActivePage('requests')
      await loadRequests()
    } catch (submitError) {
      setError(submitError.message || 'Unable to submit your request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReview = async (requestId, status) => {
    setError('')
    setWorkingRequestId(requestId)
    try {
      await reviewRequest(requestId, status)
      await loadRequests()
    } catch (reviewError) {
      setError(reviewError.message || 'Unable to update this request.')
    } finally {
      setWorkingRequestId(null)
    }
  }

  const loadUserDirectory = useCallback(async () => {
    setError('')
    setIsUsersLoading(true)
    try {
      setUserDirectory(await getUserManagementData())
    } catch (loadError) {
      setError(loadError.message || 'Unable to load users.')
    } finally {
      setIsUsersLoading(false)
    }
  }, [])

  const handleNavigate = (page) => {
    setActivePage(page)
    if (page === 'users') loadUserDirectory()
  }

  const handleCreateUser = async (event) => {
    event.preventDefault()
    setCreateUserError('')
    setIsCreatingUser(true)
    try {
      await createManagedUser({
        ...userForm,
        departmentId: userForm.departmentId || null,
      })
      setUserForm(initialUserForm)
      setIsCreateUserOpen(false)
      await loadUserDirectory()
    } catch (createError) {
      setCreateUserError(createError.message || 'Unable to create user.')
    } finally {
      setIsCreatingUser(false)
    }
  }

  const pageTitle = {
    overview: 'Overview',
    requests: isTeacher ? 'My requests' : 'All requests',
    approvals: 'Approval queue',
    documents: 'Documents',
    calendar: 'Calendar',
    users: 'User management',
  }[activePage]

  return (
    <div className="workspace">
      <aside className="workspace-sidebar">
        <a className="workspace-brand" href="/" aria-label="CampusFlow home">
          <span className="workspace-brand-mark">U</span>
          <span>Campus<span>Flow</span></span>
        </a>

        <div className="workspace-nav-label">WORKSPACE</div>
        <nav className="workspace-nav" aria-label="Main navigation">
          {visibleNavigation.map((item) => (
            <button
              className={`workspace-nav-item ${activePage === item.id ? 'active' : ''}`}
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
            >
              <span className="workspace-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'approvals' && pendingCount > 0 && (
                <span className="nav-count">{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <span className="help-mark">?</span>
            <span><strong>Need a hand?</strong><small>Contact your system administrator</small></span>
          </div>
          <button className="sidebar-signout" type="button" onClick={onSignOut}>
            <span aria-hidden="true">↪</span> Sign out
          </button>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-topbar">
          <div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{pageTitle}</strong></div>
          <div className="topbar-profile">
            <div className="topbar-profile-copy">
              <strong>{user.fullName}</strong>
              <span>{user.role}</span>
            </div>
            <span className="profile-avatar" aria-hidden="true">
              {user.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
            </span>
          </div>
        </header>

        <div className="workspace-content">
          <div className="page-heading">
            <div>
              <p className="page-eyebrow">{user.department || 'UNIVERSITY WORKFLOW'}</p>
              <h1>{activePage === 'overview' ? `Good day, ${user.fullName.split(' ')[0]}` : pageTitle}</h1>
              <p className="page-subtitle">
                {activePage === 'overview'
                  ? 'Here is what is happening across your workspace.'
                  : 'Track and manage university workflow activity.'}
              </p>
            </div>
            {isTeacher && (
              <button className="primary-action" type="button" onClick={() => setIsCreateOpen(true)}>
                <span aria-hidden="true">+</span> New request
              </button>
            )}

          </div>

          {error && (
            <div className="workspace-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button>
            </div>
          )}

          {activePage === 'overview' && (
            <>
              <section className="stat-grid" aria-label="Request summary">
                <article className="stat-card">
                  <span className="stat-icon stat-icon-blue">↗</span>
                  <span className="stat-label">Total requests</span>
                  <strong>{isLoading ? '—' : requests.length}</strong>
                  <small>Recorded in the system</small>
                </article>
                <article className="stat-card">
                  <span className="stat-icon stat-icon-amber">◷</span>
                  <span className="stat-label">{canReview ? 'Awaiting review' : 'Pending requests'}</span>
                  <strong>{isLoading ? '—' : pendingCount}</strong>
                  <small>{canReview ? 'Ready for your attention' : 'Waiting for a decision'}</small>
                </article>
                <article className="stat-card">
                  <span className="stat-icon stat-icon-green">✓</span>
                  <span className="stat-label">Approved</span>
                  <strong>{isLoading ? '—' : approvedCount}</strong>
                  <small>Approved requests</small>
                </article>
              </section>

              <section className="content-card">
                <div className="card-heading">
                  <div><h2>Recent requests</h2><p>Latest activity from your workflow</p></div>
                  <button className="text-action" type="button" onClick={() => handleNavigate('requests')}>View all <span aria-hidden="true">→</span></button>
                </div>
                <RequestList
                  requests={recentRequests}
                  isLoading={isLoading}
                  isTeacher={isTeacher}
                  canReview={false}
                  onReview={handleReview}
                  workingRequestId={workingRequestId}
                />
              </section>
            </>
          )}

          {(activePage === 'requests' || activePage === 'approvals') && (
            <section className="content-card request-page-card">
              <div className="card-heading">
                <div>
                  <h2>{activePage === 'approvals' ? 'Requests awaiting your review' : 'Request activity'}</h2>
                  <p>{activePage === 'approvals' ? 'Review, approve, or reject pending submissions.' : `${requests.length} ${requests.length === 1 ? 'request' : 'requests'} in this view`}</p>
                </div>
                <button className="icon-action" type="button" onClick={loadRequests} aria-label="Refresh requests">↻</button>
              </div>
              <RequestList
                requests={activePage === 'approvals' ? requests.filter((request) => request.status === 'PENDING') : requests}
                isLoading={isLoading}
                isTeacher={isTeacher}
                canReview={canReview}
                onReview={handleReview}
                workingRequestId={workingRequestId}
              />
            </section>
          )}

          {activePage === 'documents' && (
            <IntegrationPlaceholder
              icon="▤"
              title="Document workflows are not connected yet"
              description="Document requests are saved in the Requests area. PDF uploads, Google Forms/Sheets, and Gemini analysis need their backend integrations before documents can appear here."
              action={() => setActivePage('requests')}
              actionLabel="View requests"
            />
          )}

          {activePage === 'calendar' && (
            <IntegrationPlaceholder
              icon="▦"
              title="Calendar integration is not connected yet"
              description="Meeting requests can be submitted and reviewed. Google Calendar events will appear here once the calendar integration is implemented."
              action={() => setActivePage('requests')}
              actionLabel="View meeting requests"
            />
          )}

          {activePage === 'users' && canManageUsers && (
            <section className="content-card user-directory-card">
              <div className="card-heading">
                <div>
                  <h2>University accounts</h2>
                  <p>{user.role === 'ADMIN'
                    ? 'Admins can create Manager and Teacher accounts.'
                    : 'Create accounts and assign a role and department.'}</p>
                </div>
                <div className="user-directory-actions">
                  <button className="icon-action" type="button" onClick={loadUserDirectory} aria-label="Refresh users">↻</button>
                  <button className="primary-action" type="button" onClick={() => {
                    setCreateUserError('')
                    setUserForm({
                      ...initialUserForm,
                      role: userDirectory.roles[0]?.name || '',
                    })
                    setIsCreateUserOpen(true)
                  }}>
                    <span aria-hidden="true">+</span> Create user
                  </button>
                </div>
              </div>
              {isUsersLoading ? (
                <div className="list-message"><span className="small-spinner" /> Loading users...</div>
              ) : userDirectory.users.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-state-icon">♙</span>
                  <strong>No user accounts found</strong>
                  <span>Create an account to give a university member access.</span>
                </div>
              ) : (
                <div className="user-table-wrap">
                  <table className="user-table">
                    <thead>
                      <tr><th>User</th><th>Role</th><th>Department</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {userDirectory.users.map((managedUser) => (
                        <tr key={managedUser.id}>
                          <td>
                            <strong>{managedUser.fullName}</strong>
                            <span>{managedUser.email}</span>
                          </td>
                          <td><span className="user-role-pill">{managedUser.role}</span></td>
                          <td>{managedUser.department || 'Not assigned'}</td>
                          <td><span className={`user-status status-${managedUser.status.toLowerCase()}`}>{managedUser.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      {isCreateOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isSubmitting) setIsCreateOpen(false)
        }}>
          <section className="request-modal" role="dialog" aria-modal="true" aria-labelledby="request-modal-title">
            <div className="modal-heading">
              <div><p className="page-eyebrow">SUBMIT TO YOUR DEPARTMENT</p><h2 id="request-modal-title">New request</h2></div>
              <button type="button" className="modal-close" onClick={() => setIsCreateOpen(false)} aria-label="Close dialog">×</button>
            </div>
            <form onSubmit={handleCreateRequest}>
              <label htmlFor="request-type">Request type</label>
              <select id="request-type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                <option value="MEETING">Meeting</option>
                <option value="DOCUMENT">Document</option>
              </select>

              <label htmlFor="request-title">Title</label>
              <input id="request-title" maxLength="255" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="What do you need help with?" />

              <label htmlFor="request-topic">Topic <span>(optional)</span></label>
              <input id="request-topic" value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} placeholder="Add a short topic" />

              <label htmlFor="request-description">Details <span>(optional)</span></label>
              <textarea id="request-description" rows="4" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Share any useful context" />

              {error && <div className="form-error" role="alert">{error}</div>}
              <div className="modal-actions">
                <button className="secondary-action" type="button" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>Cancel</button>
                <button className="primary-action" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit request'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isCreateUserOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isCreatingUser) setIsCreateUserOpen(false)
        }}>
          <section className="request-modal user-modal" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
            <div className="modal-heading">
              <div><p className="page-eyebrow">ACCOUNT MANAGEMENT</p><h2 id="create-user-title">Create user</h2></div>
              <button type="button" className="modal-close" onClick={() => setIsCreateUserOpen(false)} aria-label="Close dialog">×</button>
            </div>
            <form onSubmit={handleCreateUser}>
              <label htmlFor="user-full-name">Full name</label>
              <input id="user-full-name" autoComplete="name" maxLength="150" required value={userForm.fullName} onChange={(event) => setUserForm({ ...userForm, fullName: event.target.value })} placeholder="Enter the user's full name" />

              <label htmlFor="user-email">University email</label>
              <input id="user-email" autoComplete="email" type="email" maxLength="150" required value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} placeholder="name@university.edu" />

              <label htmlFor="user-password">Initial password</label>
              <input id="user-password" autoComplete="new-password" type="password" minLength="12" maxLength="72" required value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} placeholder="At least 12 characters" />

              <label htmlFor="user-role">Role</label>
              <select id="user-role" required value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}>
                {userDirectory.roles.map((role) => <option key={role.name} value={role.name}>{role.name}</option>)}
              </select>

              <label htmlFor="user-department">Department <span>(optional)</span></label>
              <select id="user-department" value={userForm.departmentId} onChange={(event) => setUserForm({ ...userForm, departmentId: event.target.value })}>
                <option value="">No department</option>
                {userDirectory.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>

              {user.role === 'ADMIN' && (
                <p className="role-policy-note">Only a Super Admin can create Admin or Super Admin accounts.</p>
              )}
              {createUserError && <div className="form-error" role="alert">{createUserError}</div>}
              <div className="modal-actions">
                <button className="secondary-action" type="button" onClick={() => setIsCreateUserOpen(false)} disabled={isCreatingUser}>Cancel</button>
                <button className="primary-action" type="submit" disabled={isCreatingUser || !userForm.role}>{isCreatingUser ? 'Creating...' : 'Create user'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

function RequestList({ requests, isLoading, isTeacher, canReview, onReview, workingRequestId }) {
  if (isLoading) {
    return <div className="list-message"><span className="small-spinner" /> Loading requests...</div>
  }

  if (requests.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">↗</span>
        <strong>No requests yet</strong>
        <span>{isTeacher ? 'Your submissions will show here when you create a request.' : 'There are no requests to show right now.'}</span>
      </div>
    )
  }

  return (
    <div className="request-list">
      {requests.map((request) => (
        <article className="request-row" key={request.id}>
          <span className={`request-type-icon ${request.type === 'MEETING' ? 'meeting' : 'document'}`}>
            {request.type === 'MEETING' ? '◷' : '▤'}
          </span>
          <div className="request-main">
            <strong>{request.title}</strong>
            <span>
              {request.type === 'MEETING' ? 'Meeting request' : 'Document request'}
              {!isTeacher && request.submittedBy ? ` · ${request.submittedBy}` : ''}
              {request.department ? ` · ${request.department}` : ''}
            </span>
            {request.description && <small>{request.description}</small>}
          </div>
          <div className="request-meta">
            <span className={`status-badge status-${request.status.toLowerCase()}`}>{request.status}</span>
            <time dateTime={request.createdAt}>{formatDate(request.createdAt)}</time>
          </div>
          {canReview && request.status === 'PENDING' && (
            <div className="review-actions">
              <button className="approve-button" type="button" onClick={() => onReview(request.id, 'APPROVED')} disabled={workingRequestId === request.id}>
                {workingRequestId === request.id ? 'Saving...' : 'Approve'}
              </button>
              <button className="reject-button" type="button" onClick={() => onReview(request.id, 'REJECTED')} disabled={workingRequestId === request.id}>Reject</button>
            </div>
          )}
        </article>
      ))}
    </div>
  )
}

function IntegrationPlaceholder({ icon, title, description, action, actionLabel }) {
  return (
    <section className="integration-placeholder">
      <span className="placeholder-icon">{icon}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <button className="secondary-action" type="button" onClick={action}>{actionLabel}</button>
    </section>
  )
}

export default Dashboard