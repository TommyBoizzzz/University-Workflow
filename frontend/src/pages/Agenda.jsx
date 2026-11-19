import { useState } from "react";

function formatMeetingDate(value) {
  if (!value) return "Date not selected";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`));
}

function Agenda({ requests, isLoading }) {
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const agendas = requests.filter((request) => (
    request.type === "MEETING" &&
    request.agenda &&
    Array.isArray(request.agenda.items)
  ));
  const selectedRequest = agendas.find((request) => request.id === selectedRequestId) || agendas[0];
  const agenda = selectedRequest?.agenda;

  return (
    <div className="documents-workspace">
      <section className="documents-intro">
        <div>
          <p className="documents-kicker">MEETING AGENDAS</p>
          <h2>Review your generated agendas.</h2>
          <p>Meeting agendas are collected here separately from their source document briefs.</p>
        </div>
        <span className="documents-ai-mark" aria-hidden="true">≡</span>
      </section>

      {isLoading ? (
        <div className="access-loading"><span className="small-spinner" /> Loading agendas...</div>
      ) : agendas.length === 0 ? (
        <div className="calendar-empty">
          <span aria-hidden="true">≡</span>
          <strong>No meeting agendas yet</strong>
          <p>Generate an agenda while creating a meeting request, and it will appear here.</p>
        </div>
      ) : (
        <div className="documents-columns">
          <section className="documents-panel saved-briefs-panel">
            <div className="documents-panel-heading saved-briefs-heading">
              <div>
                <p className="documents-kicker">SAVED AGENDAS</p>
                <h3>Your meeting agendas</h3>
              </div>
            </div>
            <div className="document-brief-list">
              {agendas.map((request) => (
                <button
                  className={`document-brief-choice ${selectedRequest?.id === request.id ? "active" : ""}`}
                  key={request.id}
                  type="button"
                  aria-pressed={selectedRequest?.id === request.id}
                  onClick={() => setSelectedRequestId(request.id)}
                >
                  <span className="document-brief-icon" aria-hidden="true">≡</span>
                  <span>
                    <strong>{request.agenda.title || request.title}</strong>
                    <small>{formatMeetingDate(request.meetingDate)} · {request.status}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <article className="document-brief-result">
            <div className="document-result-heading">
              <div>
                <p className="documents-kicker">MEETING AGENDA</p>
                <h3>{agenda.title || selectedRequest.title}</h3>
                <span>
                  {formatMeetingDate(selectedRequest.meetingDate)}
                  {selectedRequest.meetingStart
                    ? ` · ${selectedRequest.meetingStart.slice(0, 5)}`
                    : ""}
                </span>
              </div>
              <span className={`status-badge status-${selectedRequest.status?.toLowerCase()}`}>
                {selectedRequest.status}
              </span>
            </div>
            {agenda.objectives?.length > 0 && (
              <section>
                <h4>Objectives</h4>
                <ul className="document-brief-bullets">
                  {agenda.objectives.map((objective, index) => (
                    <li key={`${index}-${objective}`}>{objective}</li>
                  ))}
                </ul>
              </section>
            )}
            <section>
              <h4>Agenda</h4>
              {agenda.items.length > 0 ? (
                <ol className="agenda-page-items">
                  {agenda.items.map((item, index) => (
                    <li key={`${index}-${item.title}`}>
                      <strong>{item.title}</strong>
                      {item.durationMinutes && <span>{item.durationMinutes} min</span>}
                      {item.details && <p>{item.details}</p>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p>No agenda items were provided.</p>
              )}
            </section>
            {agenda.outcomes?.length > 0 && (
              <section>
                <h4>Expected outcomes</h4>
                <ul className="document-brief-bullets">
                  {agenda.outcomes.map((outcome, index) => (
                    <li key={`${index}-${outcome}`}>{outcome}</li>
                  ))}
                </ul>
              </section>
            )}
          </article>
        </div>
      )}
    </div>
  );
}

export default Agenda;
