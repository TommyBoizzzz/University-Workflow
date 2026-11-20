import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createRequest,
  deleteRequest,
  generateAgenda,
  getRequests,
  reviewRequest,
} from '../services/requestService.js'
import { getCurrentUser } from '../services/authService.js'
import { getAvailability, getScheduleRecommendations } from '../services/calendarService.js'
import { createDocumentBrief } from '../services/documentService.js'
import Agenda from './Agenda.jsx'
import Calendar from './Calendar.jsx'
import Documents from './Documents.jsx'
import Meeting from './Meeting.jsx'
import TeacherRequests from './TeacherRequests.jsx'
import UserManagement from './UserManagement.jsx'

const navigation = [
  { id: 'overview', path: '/', label: 'Overview', icon: '◫' },
  { id: 'requests', path: '/requests', label: 'Requests', icon: '↗', permission: ['requests', 'read'] },
  { id: 'fill-meeting', path: '/meetings', label: 'Meeting materials', icon: '▤', permission: ['requests', 'read'] },
  { id: 'agenda', path: '/agenda', label: 'Agenda', icon: '≡', permission: ['requests', 'read'] },
  { id: 'approvals', path: '/approvals', label: 'Approvals', icon: '✓', permission: ['approvals', 'read'] },
  { id: 'documents', path: '/documents', label: 'Documents', icon: '▤', permission: ['documents', 'read'] },
  { id: 'calendar', path: '/calendar', label: 'Calendar', icon: '▦', permission: ['calendar', 'read'] },
  { id: 'users', path: '/users', label: 'Users', icon: '♙', permission: ['users', 'read'] },
]

const initialForm = { title: '', topic: '', description: '', meetingDate: '', meetingStart: '', agenda: null }

function getPageFromPathname(pathname) {
  return navigation.find((item) => item.path === pathname)?.id || 'overview'
}

function getTodayDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`))
}

function Dashboard({ user, onUserUpdate, onSignOut }) {
  const [activePage, setActivePage] = useState(() => getPageFromPathname(window.location.pathname))
  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [completedFlowReport, setCompletedFlowReport] = useState(null)
  const [flowExportReport, setFlowExportReport] = useState(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [requestMethod, setRequestMethod] = useState('form')
  const [documentFile, setDocumentFile] = useState(null)
  const [documentFocus, setDocumentFocus] = useState('')
  const [documentBrief, setDocumentBrief] = useState(null)
  const [documentId, setDocumentId] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDocumentAnalyzing, setIsDocumentAnalyzing] = useState(false)
  const [availableSlots, setAvailableSlots] = useState([])
  const [availabilityWarning, setAvailabilityWarning] = useState('')
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(false)
  const [scheduleRecommendations, setScheduleRecommendations] = useState([])
  const [isScheduleGenerating, setIsScheduleGenerating] = useState(false)
  const [isAgendaGenerating, setIsAgendaGenerating] = useState(false)
  const [workingRequestId, setWorkingRequestId] = useState(null)
  const isTeacher = user.role === 'TEACHER'
  const hasPermission = (resource, action, fallback = false) => (
    user.permissions?.[resource]?.[action] ?? fallback
  )
  const canReview = hasPermission('requests', 'update', ['MANAGER', 'ADMIN', 'SUPERADMIN'].includes(user.role))
    && hasPermission('approvals', 'update', ['MANAGER', 'ADMIN', 'SUPERADMIN'].includes(user.role))
    && hasPermission('approvals', 'create', ['MANAGER', 'ADMIN', 'SUPERADMIN'].includes(user.role))
  const canCreateRequest = hasPermission('requests', 'create', isTeacher)
  const canReadRequests = hasPermission('requests', 'read', true)
  const canReadApprovals = hasPermission('approvals', 'read', canReview) && canReadRequests
  const canReadDocuments = hasPermission('documents', 'read', true)
  const canReadCalendar = hasPermission('calendar', 'read', true)
  const canCreateBrief = hasPermission('documents', 'create')
  const canManageUsers = hasPermission('users', 'read', ['ADMIN', 'SUPERADMIN'].includes(user.role))

  useEffect(() => {
    let isActive = true
    let lastRefreshAt = 0
    const refreshUserPermissions = async () => {
      if (document.visibilityState === 'hidden' || Date.now() - lastRefreshAt < 1500) return
      lastRefreshAt = Date.now()
      try {
        const currentUser = await getCurrentUser()
        if (isActive) onUserUpdate(currentUser)
      } catch (refreshError) {
        if (isActive) setError(refreshError.message || 'Unable to refresh your access permissions.')
      }
    }

    window.addEventListener('focus', refreshUserPermissions)
    document.addEventListener('visibilitychange', refreshUserPermissions)
    return () => {
      isActive = false
      window.removeEventListener('focus', refreshUserPermissions)
      document.removeEventListener('visibilitychange', refreshUserPermissions)
    }
  }, [onUserUpdate])

  useEffect(() => {
    const handlePopState = () => setActivePage(getPageFromPathname(window.location.pathname))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

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

    if (canReadRequests) {
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
    }

    return () => {
      isActive = false
    }
  }, [canReadRequests])

  useEffect(() => {
    if (!isCreateOpen || !form.meetingDate) return undefined

    let isActive = true
    getAvailability(form.meetingDate)
      .then((data) => {
        if (!isActive) return
        setAvailableSlots(data.slots)
        setAvailabilityWarning(data.warning || '')
      })
      .catch((availabilityError) => {
        if (isActive) {
          setAvailableSlots([])
          setError(availabilityError.message || 'Unable to check meeting availability.')
        }
      })
      .finally(() => {
        if (isActive) setIsAvailabilityLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [form.meetingDate, isCreateOpen])

  const pendingCount = useMemo(
    () => requests.filter((request) => request.status === 'PENDING').length,
    [requests],
  )
  const approvedCount = useMemo(
    () => requests.filter((request) => request.status === 'APPROVED').length,
    [requests],
  )
  const recentRequests = requests.slice(0, 5)
  const draftFlowReport = documentBrief && form.agenda
    ? {
        request: {
          title: form.title || documentBrief.title,
          topic: form.topic,
          meetingDate: form.meetingDate,
          meetingStart: form.meetingStart,
        },
        fileName: documentFile?.name || 'Uploaded document',
        brief: documentBrief,
        agenda: form.agenda,
        submitted: false,
      }
    : null
  const visibleNavigation = navigation.filter(
    (item) => (item.id !== 'approvals' || canReadRequests)
      && (!item.permission || hasPermission(
        item.permission[0],
        item.permission[1],
        item.id === 'users' ? ['ADMIN', 'SUPERADMIN'].includes(user.role) : true,
      )),
  )

  const handleCreateRequest = async (event) => {
    event.preventDefault()
    setError('')
    setSuccessMessage('')
    if (requestMethod === 'document' && (!documentBrief || !form.agenda)) {
      setError('Read the document and create its agenda before submitting this request.')
      return
    }
    setIsSubmitting(true)
    try {
      const result = await createRequest({
        type: 'MEETING',
        title: form.title,
        topic: form.topic,
        description: form.description,
        meetingDate: form.meetingDate,
        meetingStart: form.meetingStart,
        ...(form.agenda ? { agenda: form.agenda } : {}),
        ...(requestMethod === 'document' && documentId ? { documentId } : {}),
      })
      if (requestMethod === 'document' && documentBrief && form.agenda) {
        setCompletedFlowReport({
          request: result.request,
          fileName: documentFile?.name || 'Uploaded document',
          brief: documentBrief,
          agenda: form.agenda,
          submitted: true,
        })
      }
      setForm(initialForm)
      setIsCreateOpen(false)
      setSuccessMessage('Your meeting request was submitted. The selected time is held until it is approved or rejected.')
      if (canReadRequests) {
        setActivePage('requests')
        await loadRequests()
      } else {
        setActivePage('overview')
      }
    } catch (submitError) {
      setError(submitError.message || 'Unable to submit your request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGenerateAgenda = async () => {
    setError('')
    setIsAgendaGenerating(true)
    try {
      const result = await generateAgenda({
        title: form.title,
        topic: form.topic,
        description: form.description,
      })
      setForm((previous) => ({ ...previous, agenda: result.agenda }))
    } catch (agendaError) {
      setError(agendaError.message || 'Unable to generate an agenda.')
    } finally {
      setIsAgendaGenerating(false)
    }
  }

  const exportCompletedFlow = (type, report) => {
    setFlowExportReport({ ...report, exportType: type })
    window.setTimeout(() => window.print(), 0)
  }

  const handleReadDocument = async () => {
    setError('')
    if (!documentFile) {
      setError('Choose a PDF or Word document first.')
      return
    }

    setIsDocumentAnalyzing(true)
    try {
      const result = await createDocumentBrief({ file: documentFile, topic: documentFocus })
      const brief = result.document.brief
      const topic = documentFocus.trim() || brief.keyPoints?.slice(0, 3).join('; ') || ''
      const description = [
        brief.executiveSummary,
        brief.keyPoints?.length ? `Key points: ${brief.keyPoints.join('; ')}` : '',
        brief.dates?.length ? `Important dates: ${brief.dates.join('; ')}` : '',
        brief.actions?.length ? `Follow-up actions: ${brief.actions.map((action) => action.task).join('; ')}` : '',
        brief.risks?.length ? `Risks and open questions: ${brief.risks.join('; ')}` : '',
      ].filter(Boolean).join('\n').slice(0, 10000)
      setDocumentBrief(brief)
      setDocumentId(result.document.id)
      setForm((previous) => ({
        ...previous,
        title: brief.title,
        topic: topic.slice(0, 2000),
        description,
        agenda: null,
      }))
    } catch (documentError) {
      setError(documentError.message || 'Unable to read the document.')
    } finally {
      setIsDocumentAnalyzing(false)
    }
  }

  const handleGenerateSchedule = async () => {
    setError('')
    setIsScheduleGenerating(true)
    try {
      const result = await getScheduleRecommendations({
        date: form.meetingDate,
        title: form.title,
        topic: form.topic,
        description: form.description,
      })
      setScheduleRecommendations(result.recommendations)
    } catch (scheduleError) {
      setScheduleRecommendations([])
      setError(scheduleError.message || 'Unable to recommend an available meeting time.')
    } finally {
      setIsScheduleGenerating(false)
    }
  }

  const updateMeetingDetails = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
      ...(['title', 'topic', 'description'].includes(field) ? { agenda: null } : {}),
    }))
    setScheduleRecommendations([])
  }

  const handleReview = async (requestId, status) => {
    setError('')
    setSuccessMessage('')
    setWorkingRequestId(requestId)
    try {
      const result = await reviewRequest(requestId, status)
      setSuccessMessage(result.warning || `Request ${status.toLowerCase()} successfully.`)
      await loadRequests()
    } catch (reviewError) {
      setError(reviewError.message || 'Unable to update this request.')
    } finally {
      setWorkingRequestId(null)
    }
  }

  const handleDeleteRequest = async (request) => {
    if (!window.confirm(`Delete "${request.title}"? Only pending requests can be deleted.`)) return

    setError('')
    setSuccessMessage('')
    setWorkingRequestId(request.id)
    try {
      await deleteRequest(request.id)
      setSuccessMessage('Request deleted.')
      await loadRequests()
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete this request.')
    } finally {
      setWorkingRequestId(null)
    }
  }

  const handleExportRequest = (request, format) => {
    setError('')
    try {
      if (format === 'pdf') {
        openRequestPdf(request)
        setSuccessMessage('The request is ready in the print dialog. Choose Save as PDF to export it.')
      } else {
        downloadRequestWordDocument(request)
        setSuccessMessage('Word document exported.')
      }
    } catch (exportError) {
      setError(exportError.message || 'Unable to export this request.')
    }
  }

  const handleNavigate = (page) => {
    setActivePage(page)
    const route = navigation.find((item) => item.id === page)
    if (route && window.location.pathname !== route.path) {
      window.history.pushState({}, '', route.path)
    }
  }

  const openNewMeetingRequest = (slot = null) => {
    setForm({
      ...initialForm,
      meetingDate: slot?.date || getTodayDate(),
      meetingStart: slot?.start || '',
    })
    setRequestMethod('form')
    setDocumentFile(null)
    setDocumentFocus('')
    setDocumentBrief(null)
    setDocumentId(null)
    setIsAvailabilityLoading(true)
    setScheduleRecommendations([])
    setError('')
    setIsCreateOpen(true)
  }

  const pageTitle = {
    overview: 'Overview',
    requests: isTeacher ? 'My requests' : 'All requests',
    'fill-meeting': 'Meeting materials',
    agenda: 'Agendas',
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
            {canCreateRequest && (
              <button className="primary-action" type="button" onClick={() => openNewMeetingRequest()}>
                <span aria-hidden="true">+</span> Request a meeting
              </button>
            )}

          </div>

          {error && (
            <div className="workspace-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button>
            </div>
          )}
          {successMessage && (
            <div className="workspace-success" role="status">
              <span>{successMessage}</span>
              <button type="button" onClick={() => setSuccessMessage('')} aria-label="Dismiss message">×</button>
            </div>
          )}
          {completedFlowReport && (
            <section className="meeting-process-export completed-flow-export" aria-label="Export submitted meeting process">
              <div>
                <strong>Choose what to export</strong>
                <span>Request #{completedFlowReport.request.id} · {completedFlowReport.request.status}</span>
              </div>
              <div className="meeting-process-export-actions">
                <button className="secondary-action" type="button" onClick={() => exportCompletedFlow('agenda', completedFlowReport)}>
                  Export agenda PDF
                </button>
                <button className="secondary-action" type="button" onClick={() => exportCompletedFlow('document', completedFlowReport)}>
                  Export document PDF
                </button>
                <button className="secondary-action" type="button" onClick={() => exportCompletedFlow('combined', completedFlowReport)}>
                  Export agenda with document PDF
                </button>
              </div>
              <small>In the print dialog, choose “Save as PDF”.</small>
            </section>
          )}

          {activePage === 'overview' && (
            <>
              <section className="stat-grid" aria-label="Request summary">
                <article className="stat-card">
                  <span className="stat-icon stat-icon-blue">↗</span>
                  <span className="stat-label">Total requests</span>
                  <strong>{!canReadRequests || isLoading ? '—' : requests.length}</strong>
                  <small>Recorded in the system</small>
                </article>
                <article className="stat-card">
                  <span className="stat-icon stat-icon-amber">◷</span>
                  <span className="stat-label">{canReview ? 'Awaiting review' : 'Pending requests'}</span>
                  <strong>{!canReadRequests || isLoading ? '—' : pendingCount}</strong>
                  <small>{canReview ? 'Ready for your attention' : 'Waiting for a decision'}</small>
                </article>
                <article className="stat-card">
                  <span className="stat-icon stat-icon-green">✓</span>
                  <span className="stat-label">Approved</span>
                  <strong>{!canReadRequests || isLoading ? '—' : approvedCount}</strong>
                  <small>Approved requests</small>
                </article>
              </section>

              {canReadRequests ? (
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
                    onDelete={handleDeleteRequest}
                    onExport={handleExportRequest}
                    userId={user.id}
                    isSuperAdmin={user.role === 'SUPERADMIN'}
                    workingRequestId={workingRequestId}
                  />
                </section>
              ) : (
                <div className="empty-state"><strong>Request activity is hidden</strong><span>Your role does not have permission to read requests.</span></div>
              )}
            </>
          )}

          {(activePage === 'requests' && canReadRequests) && (
            isTeacher ? (
                <TeacherRequests
                  requests={requests}
                  isLoading={isLoading}
                  onDelete={handleDeleteRequest}
                  onExport={handleExportRequest}
                  userId={user.id}
                  isSuperAdmin={user.role === 'SUPERADMIN'}
                  workingRequestId={workingRequestId}
                />
            ) : (
              <section className="content-card request-page-card">
                <>
                  <div className="card-heading">
                    <div>
                      <h2>Request activity</h2>
                      <p>{`${requests.length} ${requests.length === 1 ? 'request' : 'requests'} in this view`}</p>
                    </div>
                    <button className="icon-action" type="button" onClick={loadRequests} aria-label="Refresh requests">↻</button>
                  </div>
                  <RequestList
                    requests={requests}
                    isLoading={isLoading}
                    isTeacher={isTeacher}
                    canReview={canReview}
                    onReview={handleReview}
                    onDelete={handleDeleteRequest}
                    onExport={handleExportRequest}
                    userId={user.id}
                    isSuperAdmin={user.role === 'SUPERADMIN'}
                    workingRequestId={workingRequestId}
                  />
                </>
              </section>
            )
          )}

          {activePage === 'approvals' && canReadApprovals && (
            <section className="content-card request-page-card">
              <div className="card-heading">
                <div>
                  <h2>Requests awaiting your review</h2>
                  <p>Review, approve, or reject pending submissions.</p>
                </div>
                <button className="icon-action" type="button" onClick={loadRequests} aria-label="Refresh requests">↻</button>
              </div>
              <RequestList
                requests={requests.filter((request) => request.status === 'PENDING')}
                isLoading={isLoading}
                isTeacher={isTeacher}
                canReview={canReview}
                onReview={handleReview}
                onDelete={handleDeleteRequest}
                onExport={handleExportRequest}
                userId={user.id}
                isSuperAdmin={user.role === 'SUPERADMIN'}
                workingRequestId={workingRequestId}
              />
            </section>
          )}

          {activePage === 'documents' && canReadDocuments && (
            <Documents canCreateBrief={canCreateBrief} />
          )}

          {activePage === 'fill-meeting' && canReadRequests && (
            <Meeting
              requests={requests}
              isLoading={isLoading}
              onDelete={handleDeleteRequest}
              onExport={handleExportRequest}
              workingRequestId={workingRequestId}
              userId={user.id}
              isSuperAdmin={user.role === 'SUPERADMIN'}
            />
          )}

          {activePage === 'agenda' && canReadRequests && (
            <Agenda requests={requests} isLoading={isLoading} />
          )}

          {activePage === 'calendar' && canReadCalendar && (
            <Calendar
              canCreateMeeting={canCreateRequest}
              onRequestMeeting={openNewMeetingRequest}
            />
          )}

          {activePage === 'users' && canManageUsers && (
            <UserManagement currentUser={user} />
          )}

          {((activePage === 'requests' && !canReadRequests)
            || (activePage === 'fill-meeting' && !canReadRequests)
            || (activePage === 'agenda' && !canReadRequests)
            || (activePage === 'approvals' && !canReadApprovals)
            || (activePage === 'documents' && !canReadDocuments)
            || (activePage === 'calendar' && !canReadCalendar)
            || (activePage === 'users' && !canManageUsers)) && (
            <IntegrationPlaceholder
              icon="⌑"
              title="Access permissions changed"
              description="Your access to this section was changed. Choose another section from the menu or refresh your workspace."
              action={() => setActivePage('overview')}
              actionLabel="Go to overview"
            />
          )}
        </div>
      </main>

      {isCreateOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isSubmitting) setIsCreateOpen(false)
        }}>
          <section className="request-modal meeting-request-modal" role="dialog" aria-modal="true" aria-labelledby="request-modal-title">
            <div className="modal-heading">
              <div><p className="page-eyebrow">SUBMIT TO YOUR DEPARTMENT</p><h2 id="request-modal-title">Request a meeting</h2></div>
              <button type="button" className="modal-close" onClick={() => setIsCreateOpen(false)} aria-label="Close dialog">×</button>
            </div>
            <form onSubmit={handleCreateRequest}>
              <fieldset className="request-method-picker">
                <legend>Choose how to prepare your request</legend>
                <label className={requestMethod === 'form' ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="request-method"
                    value="form"
                    checked={requestMethod === 'form'}
                    onChange={() => setRequestMethod('form')}
                  />
                  <span><strong>Option 1: Fill in this form</strong><small>Enter the meeting details yourself.</small></span>
                </label>
                <label className={`${requestMethod === 'document' ? 'selected' : ''} ${!canCreateBrief ? 'unavailable' : ''}`}>
                  <input
                    type="radio"
                    name="request-method"
                    value="document"
                    checked={requestMethod === 'document'}
                    disabled={!canCreateBrief}
                    onChange={() => setRequestMethod('document')}
                  />
                  <span>
                    <strong>Option 2: Use a document</strong>
                    <small>{canCreateBrief ? 'Upload a document to read it and create an agenda.' : 'Documents: Create permission is required.'}</small>
                  </span>
                </label>
              </fieldset>

              {requestMethod === 'document' && (
                <section className="meeting-document-option">
                  <MeetingWorkflowSteps
                    file={documentFile}
                    brief={documentBrief}
                    agenda={form.agenda}
                    meetingStart={form.meetingStart}
                  />
                  <label className="meeting-document-picker" htmlFor="meeting-document-file">
                    <strong>{documentFile ? documentFile.name : 'Choose a PDF or Word document'}</strong>
                    <small>Upload a PDF or .docx file (up to 10 MB).</small>
                    <input
                      id="meeting-document-file"
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      disabled={isDocumentAnalyzing || Boolean(documentBrief)}
                      onChange={(event) => {
                        const selectedFile = event.target.files?.[0] || null
                        setDocumentFile(selectedFile)
                        setDocumentBrief(null)
                        setDocumentId(null)
                        setForm((previous) => ({ ...previous, title: '', topic: '', description: '', agenda: null }))
                      }}
                    />
                  </label>
                  <label htmlFor="meeting-document-focus">What should the agenda focus on? <span>(optional)</span></label>
                  <textarea
                    id="meeting-document-focus"
                    rows="2"
                    maxLength="2000"
                    value={documentFocus}
                    disabled={isDocumentAnalyzing || Boolean(documentBrief)}
                    onChange={(event) => setDocumentFocus(event.target.value)}
                    placeholder="For example, focus on the proposal and its deadlines."
                  />
                  <p className="meeting-document-privacy">The document is sent to Google Gemini for analysis. Its generated brief is saved in Documents; the original file is not retained.</p>
                  {!documentBrief && (
                    <button
                      className="secondary-action document-agenda-button"
                      type="button"
                      onClick={handleReadDocument}
                      disabled={isDocumentAnalyzing || !documentFile || isSubmitting}
                    >
                      {isDocumentAnalyzing ? 'Reading document...' : 'Read document'}
                    </button>
                  )}
                  {documentBrief && (
                    <div className="meeting-document-summary">
                      <strong>Document read: {documentBrief.title}</strong>
                      <DocumentBriefDetails brief={documentBrief} />
                    </div>
                  )}
                  {documentBrief && (
                    <MeetingDetailFields form={form} onUpdate={updateMeetingDetails} />
                  )}
                  {documentBrief && (
                    <div className="agenda-generator">
                      <div>
                        <strong>Meeting agenda</strong>
                        <span>{form.agenda ? 'Agenda based on your meeting details is ready.' : 'Review the meeting details above, then generate the agenda.'}</span>
                      </div>
                      <button
                        className="secondary-action"
                        type="button"
                        onClick={handleGenerateAgenda}
                        disabled={!form.title.trim() || isAgendaGenerating || isSubmitting}
                      >
                        {isAgendaGenerating ? 'Generating...' : form.agenda ? 'Regenerate agenda' : 'Generate agenda'}
                      </button>
                    </div>
                  )}
                </section>
              )}

              {requestMethod === 'form' && (
                <>
                  <MeetingDetailFields form={form} onUpdate={updateMeetingDetails} />
                  <div className="agenda-generator">
                    <div>
                      <strong>Meeting agenda</strong>
                      <span>{form.agenda ? 'Gemini agenda ready and will be included with your request.' : 'Generate an agenda with Gemini before you submit.'}</span>
                    </div>
                    <button className="secondary-action" type="button" onClick={handleGenerateAgenda} disabled={!form.title.trim() || isAgendaGenerating || isSubmitting}>
                      {isAgendaGenerating ? 'Generating...' : form.agenda ? 'Regenerate agenda' : 'Generate with Gemini'}
                    </button>
                  </div>
                </>
              )}

              <div className="meeting-slot-fields">
                <label htmlFor="meeting-date">Preferred date</label>
                <input
                  id="meeting-date"
                  type="date"
                  min={getTodayDate()}
                  required
                  value={form.meetingDate}
                  onChange={(event) => {
                    setIsAvailabilityLoading(true)
                    setScheduleRecommendations([])
                    setForm((previous) => ({ ...previous, meetingDate: event.target.value, meetingStart: '' }))
                  }}
                />
                <label htmlFor="meeting-start">Available time <span>(60 minutes)</span></label>
                <select
                  id="meeting-start"
                  required
                  value={form.meetingStart}
                  disabled={isAvailabilityLoading || availableSlots.length === 0}
                  onChange={(event) => setForm((previous) => ({ ...previous, meetingStart: event.target.value }))}
                >
                  <option value="">{isAvailabilityLoading ? 'Checking availability...' : 'Choose an open time'}</option>
                  {availableSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}{scheduleRecommendations.some((recommendation) => recommendation.time === slot) ? ' · Gemini suggestion' : ''}
                    </option>
                  ))}
                </select>
                {availabilityWarning && <p className="meeting-availability-warning">{availabilityWarning}</p>}
                {!isAvailabilityLoading && availableSlots.length === 0 && (
                  <p className="meeting-availability-warning">No open times for this date. Choose another weekday.</p>
                )}
                <button
                  className="secondary-action schedule-suggest-button"
                  type="button"
                  onClick={handleGenerateSchedule}
                  disabled={!form.title.trim() || isAvailabilityLoading || availableSlots.length === 0 || isScheduleGenerating || isSubmitting}
                >
                  {isScheduleGenerating ? 'Finding a good fit...' : 'Ask Gemini to suggest times'}
                </button>
                {scheduleRecommendations.length > 0 && (
                  <div className="schedule-recommendation-list" aria-label="Gemini schedule suggestions">
                    <strong>Gemini suggestions — choose one to use it</strong>
                    {scheduleRecommendations.map((recommendation) => (
                      <button
                        className={form.meetingStart === recommendation.time ? 'selected' : ''}
                        type="button"
                        key={recommendation.time}
                        onClick={() => setForm((previous) => ({ ...previous, meetingStart: recommendation.time }))}
                      >
                        <span>{recommendation.time}</span><small>{recommendation.reason || 'Recommended from the available university schedule.'}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {form.agenda && (
                <AgendaPreview agenda={form.agenda} />
              )}
              {draftFlowReport && (
                <section className="meeting-process-export" aria-label="Export agenda and document PDFs">
                  <div>
                    <strong>Export your PDFs</strong>
                    <span>Choose the agenda, document brief, or both.</span>
                  </div>
                  <div className="meeting-process-export-actions">
                    <button className="secondary-action" type="button" onClick={() => exportCompletedFlow('agenda', draftFlowReport)}>
                      Export agenda PDF
                    </button>
                    <button className="secondary-action" type="button" onClick={() => exportCompletedFlow('document', draftFlowReport)}>
                      Export document PDF
                    </button>
                    <button className="secondary-action" type="button" onClick={() => exportCompletedFlow('combined', draftFlowReport)}>
                      Export agenda with document PDF
                    </button>
                  </div>
                  <small>In the print dialog, choose “Save as PDF”.</small>
                </section>
              )}
              {error && <div className="form-error" role="alert">{error}</div>}
              <div className="modal-actions">
                <button className="secondary-action" type="button" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>Cancel</button>
                <button className="primary-action" type="submit" disabled={isSubmitting || isDocumentAnalyzing || !form.meetingStart || (requestMethod === 'document' && (!documentBrief || !form.agenda))}>{isSubmitting ? 'Submitting...' : 'Submit meeting request'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {flowExportReport && <MeetingFlowPrintReport {...flowExportReport} />}

    </div>
  )
}

function MeetingWorkflowSteps({ file, brief, agenda, meetingStart }) {
  const steps = [
    { title: 'Upload document', complete: Boolean(file) },
    { title: 'Read & build brief', complete: Boolean(brief) },
    { title: 'Create agenda', complete: Boolean(agenda) },
    { title: 'Review & submit', complete: false, ready: Boolean(agenda && meetingStart) },
  ]
  const currentStep = steps.findIndex((step) => !step.complete)

  return (
    <ol className="meeting-process-steps" aria-label="Document meeting request workflow">
      {steps.map((step, index) => (
        <li
          className={`${step.complete ? 'complete' : ''} ${index === currentStep ? 'current' : ''}`}
          key={step.title}
          aria-current={index === currentStep ? 'step' : undefined}
        >
          <span className="meeting-process-number">{step.complete ? '✓' : index + 1}</span>
          <strong>{step.title}</strong>
          <small>{step.complete ? 'Complete' : step.ready ? 'Ready for you' : index === currentStep ? 'In progress' : 'Next'}</small>
        </li>
      ))}
    </ol>
  )
}

function DocumentBriefDetails({ brief }) {
  return (
    <div className="meeting-brief-details">
      <section>
        <h4>Executive summary</h4>
        <p>{brief.executiveSummary}</p>
      </section>
      <BriefDetailList title="Key points" items={brief.keyPoints} emptyMessage="No key points were identified." />
      <BriefDetailList title="Important dates" items={brief.dates} emptyMessage="No dates were identified." />
      <section>
        <h4>Follow-up actions</h4>
        {brief.actions?.length ? (
          <ul className="meeting-brief-actions">
            {brief.actions.map((action, index) => (
              <li key={`${action.task}-${index}`}>
                <strong>{action.task}</strong>
                <span>{[
                  action.owner ? `Owner: ${action.owner}` : '',
                  action.dueDate ? `Due: ${action.dueDate}` : '',
                ].filter(Boolean).join(' · ') || 'Owner and due date not specified'}</span>
              </li>
            ))}
          </ul>
        ) : <p>No follow-up actions were identified.</p>}
      </section>
      <BriefDetailList title="Risks and open questions" items={brief.risks} emptyMessage="No specific risks or open questions were identified." />
    </div>
  )
}

function BriefDetailList({ title, items, emptyMessage }) {
  return (
    <section>
      <h4>{title}</h4>
      {items?.length ? (
        <ul>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
      ) : <p>{emptyMessage}</p>}
    </section>
  )
}

function AgendaPreview({ agenda }) {
  return (
    <div className="generated-agenda-preview">
      <strong>{agenda.title}</strong>
      {agenda.objectives?.length > 0 && (
        <section>
          <h4>Objectives</h4>
          <ul>{agenda.objectives.map((objective, index) => <li key={`${index}-${objective}`}>{objective}</li>)}</ul>
        </section>
      )}
      <section>
        <h4>Agenda</h4>
        <ol>
          {agenda.items.map((item, index) => (
            <li key={`${item.title}-${index}`}>
              <div><span>{item.title}</span><small>{item.durationMinutes} min</small></div>
              {item.details && <p>{item.details}</p>}
            </li>
          ))}
        </ol>
      </section>
      {agenda.outcomes?.length > 0 && (
        <section>
          <h4>Expected outcomes</h4>
          <ul>{agenda.outcomes.map((outcome, index) => <li key={`${index}-${outcome}`}>{outcome}</li>)}</ul>
        </section>
      )}
    </div>
  )
}

function MeetingFlowPrintReport({ request, fileName, brief, agenda, exportType, submitted }) {
  const reportTitle = exportType === 'agenda'
    ? agenda.title || request.title || brief.title
    : exportType === 'document'
      ? brief.title
      : request.title || brief.title
  const reportLabel = {
    agenda: 'Agenda only',
    document: 'Document brief only',
    combined: 'Agenda with document',
  }[exportType]

  return (
    <article className="meeting-flow-print-report">
      <header>
        <p>UNIVERSITY WORKFLOW · {reportLabel.toUpperCase()}</p>
        <h1>{reportTitle}</h1>
        <span>{reportLabel}</span>
      </header>
      {exportType === 'combined' && submitted && (
        <>
          <section>
            <h2>Process flow</h2>
            <ol>
              <li><strong>Document submitted:</strong> {fileName}</li>
              <li><strong>Document read:</strong> detailed brief prepared from the source.</li>
              <li><strong>Agenda created:</strong> agenda generated from the brief and meeting details.</li>
              <li><strong>Meeting request submitted:</strong> Request #{request.id} was submitted for review.</li>
            </ol>
          </section>
          <section>
            <h2>Meeting details</h2>
            <dl>
              <div><dt>Request ID</dt><dd>{request.id}</dd></div>
              <div><dt>Status</dt><dd>{request.status}</dd></div>
              <div><dt>Topic</dt><dd>{request.topic || 'Not specified'}</dd></div>
              <div><dt>Meeting date</dt><dd>{request.meetingDate ? formatDate(request.meetingDate) : 'Not selected'}</dd></div>
              <div><dt>Meeting time</dt><dd>{request.meetingStart ? `${request.meetingStart.slice(0, 5)} (60 minutes)` : 'Not selected'}</dd></div>
              <div><dt>Submitted</dt><dd>{request.createdAt ? formatDate(request.createdAt) : 'Not recorded'}</dd></div>
            </dl>
            <p className="meeting-flow-report-note">The request has been submitted and is waiting for review. Check its current status in the app.</p>
          </section>
        </>
      )}
      {exportType !== 'agenda' && (
        <section>
          <h2>Detailed document brief</h2>
          <DocumentBriefDetails brief={brief} />
        </section>
      )}
      {exportType !== 'document' && (
        <section>
          <h2>Generated meeting agenda</h2>
          <AgendaPreview agenda={agenda} />
        </section>
      )}
      {exportType === 'combined' && (
        <footer>Generated from {fileName} · Review source details before acting on dates, owners, or recommendations.</footer>
      )}
    </article>
  )
}

function MeetingDetailFields({ form, onUpdate }) {
  return (
    <>
      <label htmlFor="request-title">Title</label>
      <input id="request-title" maxLength="255" required value={form.title} onChange={(event) => onUpdate('title', event.target.value)} placeholder="What do you need help with?" />

      <label htmlFor="request-topic">Topic <span>(optional)</span></label>
      <input id="request-topic" maxLength="2000" value={form.topic} onChange={(event) => onUpdate('topic', event.target.value)} placeholder="Add a short topic" />

      <label htmlFor="request-description">Details <span>(optional)</span></label>
      <textarea id="request-description" rows="4" maxLength="10000" value={form.description} onChange={(event) => onUpdate('description', event.target.value)} placeholder="Share any useful context" />
    </>
  )
}

function RequestList({
  requests,
  isLoading,
  isTeacher,
  canReview,
  onReview,
  onDelete,
  onExport,
  userId,
  isSuperAdmin,
  workingRequestId,
}) {
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
    <div className="request-grid-scroll">
      <table className="request-grid">
        <thead>
          <tr>
            <th scope="col">Request</th>
            <th scope="col">Meeting</th>
            <th scope="col">Status</th>
            <th scope="col">Submitted</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => {
            const isWorking = workingRequestId === request.id
            const canDelete = request.status === 'PENDING'
              && (isSuperAdmin || String(request.teacherId) === String(userId))

            return (
              <tr key={request.id}>
                <td>
                  <div className="request-grid-primary">
                    <span className={`request-type-icon ${request.type === 'MEETING' ? 'meeting' : 'document'}`}>
                      {request.type === 'MEETING' ? '◷' : '▤'}
                    </span>
                    <div className="request-main">
                      <strong title={request.title}>{request.title}</strong>
                      <span>
                        {request.type === 'MEETING' ? 'Meeting request' : 'Document request'}
                        {!isTeacher && request.submittedBy ? ` · ${request.submittedBy}` : ''}
                        {request.department ? ` · ${request.department}` : ''}
                      </span>
                      {request.description && (
                        <details className="request-description-details">
                          <summary>View details</summary>
                          <p>{request.description}</p>
                        </details>
                      )}
                      {request.agenda?.items?.length > 0 && (
                        <details className="request-agenda-details">
                          <summary>Agenda · {request.agenda.items.length} topics</summary>
                          <ol>{request.agenda.items.map((item, index) => <li key={`${item.title}-${index}`}>{item.title} <span>({item.durationMinutes} min)</span></li>)}</ol>
                        </details>
                      )}
                    </div>
                  </div>
                </td>
                <td className="request-grid-meeting">
                  {request.meetingDate
                    ? <>{formatDate(request.meetingDate)}<small>{request.meetingStart?.slice(0, 5) || ''}</small></>
                    : <span className="request-grid-muted">Not scheduled</span>}
                </td>
                <td><span className={`status-badge status-${request.status.toLowerCase()}`}>{request.status}</span></td>
                <td><time dateTime={request.createdAt}>{formatDate(request.createdAt)}</time></td>
                <td>
                  <div className="request-grid-actions">
                    <button className="request-export-button" type="button" onClick={() => onExport(request, 'pdf')} disabled={isWorking}>
                      PDF
                    </button>
                    <button className="request-export-button" type="button" onClick={() => onExport(request, 'word')} disabled={isWorking}>
                      Word
                    </button>
                    {canDelete && (
                      <button
                        className="request-delete-button"
                        type="button"
                        onClick={() => onDelete(request)}
                        disabled={isWorking}
                      >
                        Delete
                      </button>
                    )}
                    {canReview && request.status === 'PENDING' && (
                      <div className="request-grid-review-actions">
                        <button className="approve-button" type="button" onClick={() => onReview(request.id, 'APPROVED')} disabled={isWorking}>
                          {isWorking ? 'Saving...' : 'Approve'}
                        </button>
                        <button className="reject-button" type="button" onClick={() => onReview(request.id, 'REJECTED')} disabled={isWorking}>Reject</button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getRequestExportHtml(request) {
  const agenda = request.agenda || {}
  const brief = request.documentBrief || {}
  const briefActions = Array.isArray(brief.actions)
    ? brief.actions.map((action) => [
      action.task,
      action.owner ? `Owner: ${action.owner}` : '',
      action.dueDate ? `Due: ${action.dueDate}` : ''
    ].filter(Boolean).join(' · '))
    : []
  const meetingTime = request.meetingStart
    ? `${request.meetingStart.slice(0, 5)} (${request.meetingEnd?.slice(0, 5) || '60 min'})`
    : 'Not scheduled'
  const exportListSection = (title, items) => (
    Array.isArray(items) && items.length
      ? `<section class="subsection"><h3>${escapeHtml(title)}</h3><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`
      : ''
  )
  const briefSection = [
    brief.executiveSummary ? `<section class="subsection"><h3>Executive summary</h3><p>${escapeHtml(brief.executiveSummary)}</p></section>` : '',
    exportListSection('Key points', brief.keyPoints),
    exportListSection('Important dates', brief.dates),
    exportListSection('Follow-up actions', briefActions),
    exportListSection('Risks and open questions', brief.risks)
  ].join('')
  const agendaSection = [
    exportListSection('Objectives', agenda.objectives),
    Array.isArray(agenda.items) && agenda.items.length
      ? `<section class="subsection"><h3>Agenda items</h3>${agenda.items.map((item, index) => `<div class="agenda-item"><span class="agenda-number">${index + 1}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.durationMinutes)} min${item.details ? ` · ${escapeHtml(item.details)}` : ''}</small></div></div>`).join('')}</section>`
      : '',
    exportListSection('Expected outcomes', agenda.outcomes)
  ].join('')

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(request.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@100..900&display=swap" rel="stylesheet">
<style>
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Noto Sans Khmer",sans-serif;color:#243247;line-height:1.35;margin:20px}
h1{color:#1f3a5b;margin-bottom:2px}h2{font-size:17px;margin:0}
.meta{color:#65758b;margin:0 0 10px}.details{width:100%;border-collapse:collapse}
.details th,.details td{padding:5px 7px;border:1px solid #dce3eb;text-align:left;vertical-align:top}
.details th{width:160px;color:#506178}.export-section{margin-top:8px;border:1px solid #cdded8;border-radius:8px;overflow:hidden;box-shadow:0 3px 10px rgba(47,91,82,0.07)}
.export-section-header{padding:7px 12px;border-bottom:1px solid #dce3eb;background:linear-gradient(110deg,#dcefe8,#edf5f1 70%,#dfe8f7)}
.export-section-header.agenda-header{border-bottom-color:#e8dcb8;background:linear-gradient(110deg,#f7edcf,#fff8e7 70%,#efe4c6)}
.export-section-header span{display:block;color:#71817f;font-size:10px;font-weight:bold;letter-spacing:1px}
.export-section-header h2{color:#304956}.export-section-header.agenda-header h2{color:#80632f}
.export-section-body{padding:2px 12px 8px}.subsection{margin-top:6px;padding:5px 7px;border:1px solid #edf2ef;border-radius:6px;background:#fbfdfc}.subsection h3{margin:0 0 3px;font-size:13px;color:#4d7c70}
.agenda-header + .export-section-body .subsection{border-color:#f1ead7;background:#fffdf7}.agenda-header + .export-section-body .subsection h3{color:#9a7437}
.subsection p,.subsection li{font-size:11px}.subsection ul{margin:2px 0}.agenda-item{display:flex;gap:7px;padding:4px 0;border-bottom:1px solid #edf1f0}
.agenda-number{display:grid;place-items:center;flex:0 0 28px;width:28px;height:28px;border-radius:50%;background:#eee9d7;color:#76622e;font-weight:bold}
.agenda-item strong{display:block}.agenda-item small{display:block;color:#64748b}@media print{body{margin:16mm}.export-section{break-inside:avoid}}
</style></head><body>
<h1>${escapeHtml(request.title)}</h1>
<p class="meta">${escapeHtml(request.type === 'MEETING' ? 'Meeting request' : 'Document request')} · ${escapeHtml(request.status)}</p>
<table class="details"><tbody>
<tr><th>Submitted by</th><td>${escapeHtml(request.submittedBy || 'Not specified')}</td></tr>
<tr><th>Department</th><td>${escapeHtml(request.department || 'Not specified')}</td></tr>
<tr><th>Topic</th><td>${escapeHtml(request.topic || 'Not specified')}</td></tr>
<tr><th>Meeting date</th><td>${escapeHtml(request.meetingDate ? formatDate(request.meetingDate) : 'Not scheduled')}</td></tr>
<tr><th>Meeting time</th><td>${escapeHtml(meetingTime)}</td></tr>
<tr><th>Submitted</th><td>${escapeHtml(request.createdAt ? formatDate(request.createdAt) : 'Not recorded')}</td></tr>
</tbody></table>
<section><h2>Details</h2><p>${escapeHtml(request.description || 'No additional details.')}</p></section>
${brief.executiveSummary || brief.keyPoints?.length || brief.dates?.length || briefActions.length || brief.risks?.length
  ? `<section class="export-section"><header class="export-section-header"><span>SECTION 1</span><h2>Document Brief</h2></header><div class="export-section-body">${briefSection}</div></section>`
  : ''}
${agendaSection
  ? `<section class="export-section"><header class="export-section-header agenda-header"><span>SECTION 2</span><h2>${escapeHtml(agenda.title || 'Meeting Agenda')}</h2></header><div class="export-section-body">${agendaSection}</div></section>`
  : ''}
</body></html>`
}

function getRequestExportFileName(title) {
  const fileName = String(title || 'meeting-request')
    .replace(/[<>:"/\\|?*]/g, '-')
    .split('')
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return fileName || 'meeting-request'
}

function openRequestPdf(request) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('Allow pop-ups in your browser to export requests as PDF.')
  }

  printWindow.document.open()
  printWindow.document.write(getRequestExportHtml(request))
  printWindow.document.close()
  window.setTimeout(() => {
    if (!printWindow.closed) {
      printWindow.focus()
      printWindow.print()
    }
  }, 250)
}

function downloadRequestWordDocument(request) {
  const blob = new Blob(['\ufeff', getRequestExportHtml(request)], {
    type: 'application/msword;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${getRequestExportFileName(request.title)}.doc`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
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