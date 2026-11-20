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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const agendas = requests.filter((request) => (
    request.type === "MEETING" &&
    request.agenda &&
    Array.isArray(request.agenda.items)
  ));
  const selectedRequest = agendas.find((request) => request.id === selectedRequestId) || agendas[0];
  const agenda = selectedRequest?.agenda;

  const handleExportAgenda = (request, format) => {
    setError("");
    setNotice("");
    try {
      if (format === "pdf") {
        openAgendaPdf(request);
        setNotice("The agenda is ready in the print dialog. Choose Save as PDF to export it.");
      } else {
        downloadAgendaWord(request);
        setNotice("Word agenda exported.");
      }
    } catch (exportError) {
      setError(exportError.message || "Unable to export this agenda.");
    }
  };

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

      {error && <div className="workspace-error documents-feedback" role="alert">{error}</div>}
      {notice && <div className="workspace-success documents-feedback" role="status">{notice}</div>}

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
                <div
                  className={`meeting-material-row ${selectedRequest?.id === request.id ? "active" : ""}`}
                  key={request.id}
                >
                  <button
                    className="meeting-material-select"
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
                  <div className="meeting-material-actions">
                    <button
                      className="meeting-material-action export"
                      type="button"
                      onClick={() => handleExportAgenda(request, "pdf")}
                    >
                      Export
                    </button>
                  </div>
                </div>
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
              <div className="document-result-actions standard-export-actions">
                <span className={`status-badge status-${selectedRequest.status?.toLowerCase()}`}>
                  {selectedRequest.status}
                </span>
                <button
                  className="meeting-material-action export document-export-button"
                  type="button"
                  onClick={() => handleExportAgenda(selectedRequest, "pdf")}
                >
                  <span className="meeting-export-icon" aria-hidden="true">↓</span>
                  Export PDF
                </button>
                <button
                  className="meeting-material-action export"
                  type="button"
                  onClick={() => handleExportAgenda(selectedRequest, "word")}
                >
                  <span className="agenda-word-icon" aria-hidden="true">W</span>
                  Export Word
                </button>
              </div>
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

function escapeAgendaExportHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getAgendaExportHtml(request) {
  const agenda = request.agenda || {};
  const objectives = Array.isArray(agenda.objectives) ? agenda.objectives : [];
  const items = Array.isArray(agenda.items) ? agenda.items : [];
  const outcomes = Array.isArray(agenda.outcomes) ? agenda.outcomes : [];

  const objectivesHtml = objectives.length
    ? `<section class="agenda-card"><h3>Objectives</h3><ul>${objectives.map((item) => `<li>${escapeAgendaExportHtml(item)}</li>`).join("")}</ul></section>`
    : "";
  const agendaItemsHtml = items.length
    ? `<section class="agenda-card agenda-items"><h3>Agenda items</h3><ol>${items.map((item, index) => `
      <li>
        <div class="agenda-item-number">${index + 1}</div>
        <div class="agenda-item-content">
          <div class="agenda-item-heading">
            <strong>${escapeAgendaExportHtml(item.title || "Agenda item")}</strong>
            ${item.durationMinutes ? `<span>${escapeAgendaExportHtml(item.durationMinutes)} min</span>` : ""}
          </div>
          ${item.details ? `<p>${escapeAgendaExportHtml(item.details)}</p>` : ""}
        </div>
      </li>`).join("")}</ol></section>`
    : `<section class="agenda-card"><p>No agenda items were provided.</p></section>`;
  const outcomesHtml = outcomes.length
    ? `<section class="agenda-card"><h3>Expected outcomes</h3><ul>${outcomes.map((item) => `<li>${escapeAgendaExportHtml(item)}</li>`).join("")}</ul></section>`
    : "";

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeAgendaExportHtml(agenda.title || request.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@100..900&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:10mm 12mm 12mm}
*{box-sizing:border-box}
body{font-family:"Noto Sans Khmer",sans-serif;color:#26384a;line-height:1.42;margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:186mm;margin:0 auto;padding:5mm 0 4mm}
.top-rule{height:4px;margin-bottom:10px;border-top:3px solid #a77a2e;border-right:110mm solid #4b7e78;border-bottom:1px solid #d7b867}
.document-header{display:flex;align-items:flex-end;justify-content:space-between;padding:3px 0 12px;border-bottom:1px solid #e4e5dc}
.brand{font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#6f6a50}
.brand-line{display:block;width:34px;height:3px;margin-top:5px;background:#c3a24f}
.document-no{text-align:right;color:#87918f;font-size:8px;letter-spacing:.5px;text-transform:uppercase}
.document-no strong{display:block;margin-top:2px;color:#6f5f32;font-size:9px}
.title-panel{margin:12px 0 10px;padding:15px 18px 14px;border-left:5px solid #b18b45;border-radius:0 8px 8px 0;background:#f7f1df}
.title-panel .eyebrow{margin:0 0 5px;color:#7d7a66;font-size:8px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase}
.title-panel h1{margin:0;color:#294c5a;font-family:"Noto Sans Khmer",sans-serif;font-size:22px;line-height:1.35}
.meta-strip{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 11px}
.meta-item{display:inline-flex;align-items:center;min-height:23px;padding:4px 8px;border:1px solid #e4e2d5;border-radius:999px;color:#677477;font-size:9px}
.meta-item strong{margin-right:5px;color:#7e7149;font-size:8px;text-transform:uppercase;letter-spacing:.6px}
.section-heading{display:flex;align-items:center;gap:8px;margin:11px 0 7px;color:#244c5c}
.section-heading:before{content:"";width:22px;height:3px;background:#c3a24f}
.section-heading h2{margin:0;font-size:11px;letter-spacing:.7px;text-transform:uppercase}
.agenda-card{margin:0 0 7px;padding:9px 11px;border:1px solid #e4e6dc;border-radius:7px;background:#fff;break-inside:avoid}
.agenda-card h3{margin:0 0 5px;color:#7d6737;font-size:11px}
.agenda-card p,.agenda-card li{font-size:10.5px}
.agenda-card ul{margin:3px 0 1px;padding-left:17px}
.agenda-card li{margin:3px 0}
.agenda-card li::marker{color:#b18b45}
.agenda-items ol{display:grid;gap:5px;margin:5px 0 0;padding:0;list-style:none}
.agenda-items ol>li{display:flex;gap:9px;margin:0;padding:7px 8px;border-radius:6px;background:#fbfaf5}
.agenda-item-number{display:grid;place-items:center;flex:0 0 24px;width:24px;height:24px;border-radius:50%;background:#9b7b3a;color:#fff;font-size:9px;font-weight:800}
.agenda-item-content{flex:1}
.agenda-item-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.agenda-item-heading strong{color:#36545d;font-size:10.5px}
.agenda-item-heading span{flex:none;padding:2px 6px;border:1px solid #e3dcc4;border-radius:999px;color:#8a743f;font-size:8px}
.agenda-item-content p{margin:3px 0 0;color:#687779;text-align:left}
.footer{display:flex;justify-content:space-between;margin-top:10px;padding-top:6px;border-top:1px solid #e4e6dc;color:#98a09c;font-size:7.5px}
@media print{body{width:186mm;margin:0 auto}.page{width:186mm;max-width:none;margin:0;padding:0}.agenda-card{break-inside:avoid}.footer{break-inside:avoid}}
</style></head><body>
<main class="page">
  <div class="top-rule"></div>
  <header class="document-header">
    <div class="brand">University Workflow<span class="brand-line"></span></div>
    <div class="document-no">Meeting Agenda<strong>${escapeAgendaExportHtml(request.status || "PENDING")}</strong></div>
  </header>
  <section class="title-panel">
    <p class="eyebrow">Generated meeting agenda</p>
    <h1>${escapeAgendaExportHtml(agenda.title || request.title || "Meeting Agenda")}</h1>
  </section>
  <div class="meta-strip">
    <span class="meta-item"><strong>Date</strong>${escapeAgendaExportHtml(formatMeetingDate(request.meetingDate))}</span>
    ${request.meetingStart ? `<span class="meta-item"><strong>Time</strong>${escapeAgendaExportHtml(request.meetingStart.slice(0, 5))}</span>` : ""}
  </div>
  <div class="section-heading"><h2>Meeting plan</h2></div>
  ${objectivesHtml}
  ${agendaItemsHtml}
  ${outcomesHtml}
  <footer class="footer"><span>University Workflow · Meeting Agenda</span><span>Confidential</span></footer>
</main>
</body></html>`;
}

function getAgendaExportFileName(request) {
  const fileName = String(request.agenda?.title || request.title || "meeting-agenda")
    .replace(/[<>:"/\\|?*]/g, "-")
    .split("")
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return fileName || "meeting-agenda";
}

function openAgendaPdf(request) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Allow pop-ups in your browser to export agendas as PDF.");
  }
  printWindow.document.open();
  printWindow.document.write(getAgendaExportHtml(request));
  printWindow.document.close();
  window.setTimeout(() => {
    if (!printWindow.closed) {
      printWindow.focus();
      printWindow.print();
    }
  }, 500);
}

function downloadAgendaWord(request) {
  const blob = new Blob(["\ufeff", getAgendaExportHtml(request)], {
    type: "application/msword;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = `${getAgendaExportFileName(request)}.doc`;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default Agenda;
