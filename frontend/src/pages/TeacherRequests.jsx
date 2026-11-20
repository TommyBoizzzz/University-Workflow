import { useMemo, useState } from "react";

function formatRequestDate(value) {
  if (!value) return "Date not selected";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`));
}

function TeacherRequests({
  requests,
  isLoading,
  onDelete,
  onExport,
  workingRequestId,
  userId,
  isSuperAdmin
}) {
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const counts = {
    ALL: requests.length,
    PENDING: requests.filter((request) => request.status === "PENDING").length,
    APPROVED: requests.filter((request) => request.status === "APPROVED").length,
    REJECTED: requests.filter((request) => request.status === "REJECTED").length
  };
  const visibleRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesStatus = activeFilter === "ALL" || request.status === activeFilter;
      const searchableText = [
        request.title,
        request.topic,
        request.department,
        request.type,
        request.status
      ].filter(Boolean).join(" ").toLowerCase();
      return matchesStatus && (!query || searchableText.includes(query));
    });
  }, [activeFilter, requests, search]);

  return (
    <div className="teacher-requests-page">
      <section className="teacher-requests-hero">
        <div className="teacher-requests-hero-copy">
          <p className="teacher-requests-eyebrow"><span /> YOUR WORKSPACE</p>
          <h2>My requests<span>.</span></h2>
          <p>Keep track of submissions, meeting plans, and the next steps in your workflow.</p>
        </div>
        <div className="teacher-requests-hero-art" aria-hidden="true">
          <span className="teacher-requests-art-card teacher-requests-art-back">✓</span>
          <span className="teacher-requests-art-card teacher-requests-art-front">↗</span>
          <span className="teacher-requests-art-orbit" />
        </div>
      </section>

      <section className="teacher-request-stats" aria-label="Request summary">
        <article className="teacher-request-stat total">
          <span className="teacher-request-stat-icon">▤</span>
          <div><small>Total requests</small><strong>{requests.length}</strong></div>
          <span className="teacher-request-stat-note">in your workspace</span>
        </article>
        <article className="teacher-request-stat pending">
          <span className="teacher-request-stat-icon">◷</span>
          <div><small>Waiting for review</small><strong>{counts.PENDING}</strong></div>
          <span className="teacher-request-stat-note">pending</span>
        </article>
        <article className="teacher-request-stat completed">
          <span className="teacher-request-stat-icon">✓</span>
          <div><small>Approved</small><strong>{counts.APPROVED}</strong></div>
          <span className="teacher-request-stat-note">ready to move forward</span>
        </article>
      </section>

      <section className="teacher-request-board">
        <div className="teacher-request-board-heading">
          <div>
            <p className="teacher-requests-eyebrow"><span /> REQUEST ACTIVITY</p>
            <h3>Your submissions</h3>
          </div>
          {!isLoading && <span className="teacher-request-total">{visibleRequests.length} shown</span>}
        </div>

        <div className="teacher-request-toolbar">
          <div className="teacher-request-filters" role="group" aria-label="Filter requests by status">
            {["ALL", "PENDING", "APPROVED", "REJECTED"].map((filter) => (
              <button
                className={`teacher-request-filter ${activeFilter === filter ? "active" : ""}`}
                key={filter}
                type="button"
                aria-pressed={activeFilter === filter}
                onClick={() => setActiveFilter(filter)}
              >
                {filter === "ALL" ? "All requests" : filter[0] + filter.slice(1).toLowerCase()}
                <span>{counts[filter]}</span>
              </button>
            ))}
          </div>
          <label className="teacher-request-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search requests"
              aria-label="Search requests"
            />
          </label>
        </div>

        {isLoading ? (
          <div className="teacher-request-empty"><span className="small-spinner" /> Loading your requests...</div>
        ) : visibleRequests.length === 0 ? (
          <div className="teacher-request-empty">
            <span className="teacher-request-empty-icon" aria-hidden="true">{requests.length ? "⌕" : "↗"}</span>
            <strong>{requests.length ? "No matching requests" : "Your workflow starts here"}</strong>
            <p>{requests.length ? "Try another search or status filter." : "Requests you submit will appear here, ready to track and manage."}</p>
          </div>
        ) : (
          <div className="teacher-request-list">
            {visibleRequests.map((request) => {
              const isWorking = workingRequestId === request.id;
              const isMeeting = request.type === "MEETING";
              const canDelete = request.status === "PENDING"
                && (isSuperAdmin || String(request.teacherId) === String(userId));

              return (
                <article className={`teacher-request-card ${isMeeting ? "meeting" : "document"}`} key={request.id}>
                  <div className="teacher-request-card-accent" />
                  <div className="teacher-request-card-content">
                    <div className="teacher-request-card-main">
                      <span className={`teacher-request-type-icon ${isMeeting ? "meeting" : "document"}`} aria-hidden="true">
                        {isMeeting ? "◷" : "▤"}
                      </span>
                      <div className="teacher-request-card-title">
                        <div className="teacher-request-card-kicker">
                          {isMeeting ? "MEETING REQUEST" : "DOCUMENT REQUEST"}
                          {request.department && <><span>·</span>{request.department}</>}
                        </div>
                        <h4>{request.title}</h4>
                        {request.topic && <p>{request.topic}</p>}
                      </div>
                      <span className={`status-badge status-${request.status?.toLowerCase()}`}>
                        <span className="teacher-status-dot" />{request.status}
                      </span>
                    </div>

                    <div className="teacher-request-card-meta">
                      <span><i aria-hidden="true">▦</i>{request.meetingDate ? formatRequestDate(request.meetingDate) : "No date scheduled"}</span>
                      {request.meetingStart && <span><i aria-hidden="true">◷</i>{request.meetingStart.slice(0, 5)}</span>}
                      {request.createdAt && <span><i aria-hidden="true">↗</i>Submitted {formatRequestDate(request.createdAt)}</span>}
                      {request.agenda?.items?.length > 0 && <span><i aria-hidden="true">≡</i>{request.agenda.items.length} agenda items</span>}
                    </div>

                    {(request.description || request.agenda || request.documentBrief) && (
                      <details className="teacher-request-details-disclosure">
                        <summary>View request details <span aria-hidden="true">⌄</span></summary>
                        {request.description && <p className="teacher-request-description">{request.description}</p>}
                        {request.documentBrief && <DocumentBriefDetails brief={request.documentBrief} />}
                        {request.agenda && <AgendaDetails agenda={request.agenda} />}
                      </details>
                    )}

                    <div className="teacher-request-card-footer">
                      <span className="teacher-request-id">REQUEST <strong>#{String(request.id).slice(-6)}</strong></span>
                      <div className="teacher-request-card-actions">
                        {canDelete && (
                          <button
                            className="teacher-request-delete"
                            type="button"
                            onClick={() => onDelete(request)}
                            disabled={isWorking}
                          >
                            Delete
                          </button>
                        )}
                        <button
                          className="teacher-request-word"
                          type="button"
                          onClick={() => onExport(request, "word")}
                          disabled={isWorking}
                        >
                          <span aria-hidden="true">W</span> Word
                        </button>
                        <button
                          className="teacher-request-pdf"
                          type="button"
                          onClick={() => onExport(request, "pdf")}
                          disabled={isWorking}
                        >
                          <span aria-hidden="true">↓</span> Export PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function DocumentBriefDetails({ brief }) {
  return (
    <div className="meeting-brief-details">
      {brief.executiveSummary && <section><h4>Executive summary</h4><p>{brief.executiveSummary}</p></section>}
      {brief.keyPoints?.length > 0 && <BriefList title="Key points" items={brief.keyPoints} />}
      {brief.dates?.length > 0 && <BriefList title="Important dates" items={brief.dates} />}
      {brief.risks?.length > 0 && <BriefList title="Risks and open questions" items={brief.risks} />}
    </div>
  );
}

function BriefList({ title, items }) {
  return (
    <section>
      <h4>{title}</h4>
      <ul className="document-brief-bullets">
        {items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
      </ul>
    </section>
  );
}

function AgendaDetails({ agenda }) {
  return (
    <div className="generated-agenda-preview">
      {agenda.objectives?.length > 0 && (
        <section>
          <h4>Objectives</h4>
          <ul>{agenda.objectives.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
        </section>
      )}
      <section>
        <h4>Agenda items</h4>
        <ol>
          {agenda.items.map((item, index) => (
            <li key={`${item.title}-${index}`}>
              <div><span>{item.title}</span><small>{item.durationMinutes} min</small></div>
              {item.details && <p>{item.details}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export default TeacherRequests;
