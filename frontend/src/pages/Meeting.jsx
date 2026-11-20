import { useState } from "react";

const MEETING_PAGE_SIZE = 6;

function formatMeetingDate(value) {
  if (!value) return "Date not selected";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`));
}

function Meeting({
  requests,
  isLoading,
  onDelete,
  onExport,
  workingRequestId,
  userId,
  isSuperAdmin
}) {
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [meetingSearch, setMeetingSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const meetings = requests.filter((request) => (
    request.type === "MEETING" &&
    request.documentBrief &&
    request.agenda
  ));
  const query = meetingSearch.trim().toLocaleLowerCase();
  const filteredMeetings = meetings.filter((meeting) => (
    [
      meeting.title,
      meeting.sourceFilename,
      meeting.status,
      formatMeetingDate(meeting.meetingDate),
      meeting.documentBrief.title,
      meeting.agenda.title,
    ].some((value) => String(value || "").toLocaleLowerCase().includes(query))
  ));
  const pageCount = Math.max(1, Math.ceil(filteredMeetings.length / MEETING_PAGE_SIZE));
  const currentPageNumber = Math.min(currentPage, pageCount);
  const visibleMeetings = filteredMeetings.slice(
    (currentPageNumber - 1) * MEETING_PAGE_SIZE,
    currentPageNumber * MEETING_PAGE_SIZE,
  );
  const firstVisibleMeeting = filteredMeetings.length
    ? (currentPageNumber - 1) * MEETING_PAGE_SIZE + 1
    : 0;
  const lastVisibleMeeting = Math.min(currentPageNumber * MEETING_PAGE_SIZE, filteredMeetings.length);
  const selectedMeeting = visibleMeetings.find((request) => request.id === selectedRequestId)
    || visibleMeetings[0];

  return (
    <div className="documents-workspace">
      <section className="documents-intro">
        <div>
          <p className="documents-kicker">Meeting</p>
          <h2>Documents and agendas for your meetings.</h2>
          <p>Select a meeting to view only its linked document brief and generated agenda.</p>
        </div>
        <div className="meeting-intro-summary">
          <span className="documents-ai-mark" aria-hidden="true">▤</span>
          <span><strong>{meetings.length}</strong><small>{meetings.length === 1 ? "meeting" : "meetings"}</small></span>
        </div>
      </section>

      {isLoading ? (
        <div className="access-loading"><span className="small-spinner" /> Loading Meeting...</div>
      ) : meetings.length === 0 ? (
        <div className="calendar-empty">
          <span aria-hidden="true">▤</span>
          <strong>No Meeting yet</strong>
          <p>Meetings with a linked document brief and agenda will appear here after submission.</p>
        </div>
      ) : (
        <div className="documents-columns meeting-materials-columns">
          <section className="documents-panel saved-briefs-panel meeting-list-panel">
            <div className="documents-panel-heading saved-briefs-heading">
              <div>
                <p className="documents-kicker">MEETINGS</p>
                <h3>Your meetings</h3>
              </div>
              <span className="meeting-list-count">{meetings.length}</span>
            </div>
            <div className="user-directory-toolbar documents-search-toolbar">
              <label className="user-search" htmlFor="meeting-search">
                <span aria-hidden="true">⌕</span>
                <input
                  id="meeting-search"
                  type="search"
                  value={meetingSearch}
                  onChange={(event) => {
                    setMeetingSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search title, date, source, status..."
                />
              </label>
              <span className="user-result-count">
                Showing {firstVisibleMeeting}–{lastVisibleMeeting} of {filteredMeetings.length}
              </span>
            </div>
            {filteredMeetings.length === 0 ? (
              <div className="calendar-empty">
                <span aria-hidden="true">⌕</span>
                <strong>No matching meetings</strong>
                <p>Try a different title, date, source, or status.</p>
              </div>
            ) : (
              <>
                <div className="document-brief-list">
                  {visibleMeetings.map((meeting) => {
                    const isWorking = workingRequestId === meeting.id;
                    const canDelete = meeting.status === "PENDING"
                      && (isSuperAdmin || String(meeting.teacherId) === String(userId));

                    return (
                      <div
                        className={`meeting-material-row ${selectedMeeting?.id === meeting.id ? "active" : ""}`}
                        key={meeting.id}
                      >
                        <button
                          className="meeting-material-select"
                          type="button"
                          aria-pressed={selectedMeeting?.id === meeting.id}
                          onClick={() => setSelectedRequestId(meeting.id)}
                        >
                          <span className="document-brief-icon" aria-hidden="true">▤</span>
                          <span>
                            <strong>{meeting.title}</strong>
                            <small>{formatMeetingDate(meeting.meetingDate)} · {meeting.status}</small>
                          </span>
                        </button>
                        <div className="meeting-material-actions">
                          <button
                            className="meeting-material-action export"
                            type="button"
                            onClick={() => onExport(meeting, "pdf")}
                            disabled={isWorking}
                          >
                            Export
                          </button>
                          {canDelete && (
                            <button
                              className="meeting-material-action delete"
                              type="button"
                              onClick={() => onDelete(meeting)}
                              disabled={isWorking}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {pageCount > 1 && (
                  <nav className="documents-pagination" aria-label="Meeting pages">
                    <button
                      className="documents-page-button"
                      type="button"
                      onClick={() => setCurrentPage(Math.max(1, currentPageNumber - 1))}
                      disabled={currentPageNumber === 1}
                    >
                      Previous
                    </button>
                    <span>Page {currentPageNumber} of {pageCount}</span>
                    <button
                      className="documents-page-button"
                      type="button"
                      onClick={() => setCurrentPage(Math.min(pageCount, currentPageNumber + 1))}
                      disabled={currentPageNumber === pageCount}
                    >
                      Next
                    </button>
                  </nav>
                )}
              </>
            )}
          </section>

          {selectedMeeting && (
            <article className="document-brief-result meeting-detail-panel">
            <div className="document-result-heading">
              <div>
                <p className="documents-kicker">MEETING</p>
                <h3>{selectedMeeting.title}</h3>
                <span>
                  {formatMeetingDate(selectedMeeting.meetingDate)}
                  {selectedMeeting.meetingStart
                    ? ` · ${selectedMeeting.meetingStart.slice(0, 5)}`
                    : ""}
                  {selectedMeeting.sourceFilename ? ` · ${selectedMeeting.sourceFilename}` : ""}
                </span>
              </div>
              <div className="document-result-actions standard-export-actions">
                <span className={`status-badge status-${selectedMeeting.status?.toLowerCase()}`}>
                  {selectedMeeting.status}
                </span>
                <button
                  className="meeting-material-action export document-export-button"
                  type="button"
                  onClick={() => onExport(selectedMeeting, "pdf")}
                  disabled={workingRequestId === selectedMeeting.id}
                >
                  <span className="meeting-export-icon" aria-hidden="true">↓</span>
                  Export PDF
                </button>
                <button
                  className="meeting-material-action export"
                  type="button"
                  onClick={() => onExport(selectedMeeting, "word")}
                  disabled={workingRequestId === selectedMeeting.id}
                >
                  <span className="agenda-word-icon" aria-hidden="true">W</span>
                  Export Word
                </button>
                {selectedMeeting.status === "PENDING"
                  && (isSuperAdmin || String(selectedMeeting.teacherId) === String(userId)) && (
                    <button
                      className="meeting-material-action delete"
                      type="button"
                      onClick={() => onDelete(selectedMeeting)}
                      disabled={workingRequestId === selectedMeeting.id}
                    >
                      Delete
                    </button>
                  )}
              </div>
            </div>
            <section className="meeting-document-section brief-section">
              <div className="meeting-section-heading">
                <span className="meeting-section-icon" aria-hidden="true">▤</span>
                <div>
                  <p>SECTION 1</p>
                  <h4>Document Brief</h4>
                </div>
              </div>
              <DocumentBriefDetails brief={selectedMeeting.documentBrief} />
            </section>
            <section className="meeting-document-section agenda-section">
              <div className="meeting-section-heading">
                <span className="meeting-section-icon" aria-hidden="true">≡</span>
                <div>
                  <p>SECTION 2</p>
                  <h4>Meeting Agenda</h4>
                </div>
              </div>
              <AgendaDetails agenda={selectedMeeting.agenda} />
            </section>
            </article>
          )}
        </div>
      )}
    </div>
  );
}

function DocumentBriefDetails({ brief }) {
  return (
    <div className="meeting-brief-details">
      <section>
        <h4>Executive summary</h4>
        <p>{brief.executiveSummary}</p>
      </section>
      {brief.keyPoints?.length > 0 && <BriefList title="Key points" items={brief.keyPoints} />}
      {brief.dates?.length > 0 && <BriefList title="Important dates" items={brief.dates} />}
      {brief.actions?.length > 0 && (
        <BriefList
          title="Follow-up actions"
          items={brief.actions.map((action) => [
            action.task,
            action.owner ? `Owner: ${action.owner}` : "",
            action.dueDate ? `Due: ${action.dueDate}` : ""
          ].filter(Boolean).join(" · "))}
        />
      )}
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
      <strong>{agenda.title}</strong>
      {agenda.objectives?.length > 0 && (
        <section>
          <h4>Objectives</h4>
          <ul>{agenda.objectives.map((objective, index) => <li key={`${index}-${objective}`}>{objective}</li>)}</ul>
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
      {agenda.outcomes?.length > 0 && (
        <section>
          <h4>Expected outcomes</h4>
          <ul>{agenda.outcomes.map((outcome, index) => <li key={`${index}-${outcome}`}>{outcome}</li>)}</ul>
        </section>
      )}
    </div>
  );
}

export default Meeting;
