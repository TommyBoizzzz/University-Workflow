import { useState } from "react";

function formatMeetingDate(value) {
  if (!value) return "Date not selected";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`));
}

function Meeting({ requests, isLoading }) {
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const meetings = requests.filter((request) => (
    request.type === "MEETING" &&
    request.documentBrief &&
    request.agenda
  ));
  const selectedMeeting = meetings.find((request) => request.id === selectedRequestId) || meetings[0];

  return (
    <div className="documents-workspace">
      <section className="documents-intro">
        <div>
          <p className="documents-kicker">MEETING MATERIALS</p>
          <h2>Documents and agendas for your meetings.</h2>
          <p>Select a meeting to view only its linked document brief and generated agenda.</p>
        </div>
        <span className="documents-ai-mark" aria-hidden="true">▤</span>
      </section>

      {isLoading ? (
        <div className="access-loading"><span className="small-spinner" /> Loading meeting materials...</div>
      ) : meetings.length === 0 ? (
        <div className="calendar-empty">
          <span aria-hidden="true">▤</span>
          <strong>No meeting materials yet</strong>
          <p>Meetings with a linked document brief and agenda will appear here after submission.</p>
        </div>
      ) : (
        <div className="documents-columns">
          <section className="documents-panel saved-briefs-panel">
            <div className="documents-panel-heading saved-briefs-heading">
              <div>
                <p className="documents-kicker">MEETINGS</p>
                <h3>Document and agenda</h3>
              </div>
            </div>
            <div className="document-brief-list">
              {meetings.map((meeting) => (
                <button
                  className={`document-brief-choice ${selectedMeeting?.id === meeting.id ? "active" : ""}`}
                  key={meeting.id}
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
              ))}
            </div>
          </section>

          <article className="document-brief-result">
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
              <span className={`status-badge status-${selectedMeeting.status?.toLowerCase()}`}>
                {selectedMeeting.status}
              </span>
            </div>
            <section>
              <h4>Document brief</h4>
              <DocumentBriefDetails brief={selectedMeeting.documentBrief} />
            </section>
            <section>
              <h4>Agenda</h4>
              <AgendaDetails agenda={selectedMeeting.agenda} />
            </section>
          </article>
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
