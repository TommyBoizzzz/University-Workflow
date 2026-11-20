import { useCallback, useEffect, useState } from "react";
import { createDocumentBrief, getDocumentBriefs } from "../services/documentService.js";

function Documents({ canCreateBrief }) {
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [file, setFile] = useState(null);
  const [topic, setTopic] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refreshDocuments = useCallback(async () => {
    setError("");
    setIsLoading(true);
    try {
      const loadedDocuments = await getDocumentBriefs();
      setDocuments(loadedDocuments);
      setSelectedDocument((current) => (
        loadedDocuments.find((item) => item.id === current?.id) ||
        loadedDocuments[0] ||
        null
      ));
    } catch (loadError) {
      setError(loadError.message || "Unable to load document briefs.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getDocumentBriefs()
      .then((loadedDocuments) => {
        if (!active) return;
        setDocuments(loadedDocuments);
        setSelectedDocument(loadedDocuments[0] || null);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Unable to load document briefs.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!file) {
      setError("Choose a PDF or Word document first.");
      return;
    }

    setError("");
    setNotice("");
    setIsSubmitting(true);
    try {
      const result = await createDocumentBrief({ file, topic });
      setDocuments((current) => [result.document, ...current]);
      setSelectedDocument(result.document);
      setFile(null);
      setTopic("");
      formElement.reset();
      setNotice(result.message);
    } catch (submitError) {
      setError(submitError.message || "Unable to create the document brief.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportDocument = (document, format) => {
    setError("");
    setNotice("");
    try {
      if (format === "pdf") {
        openDocumentPdf(document);
        setNotice("The brief is ready in the print dialog. Choose Save as PDF to export it.");
      } else {
        downloadDocumentWord(document);
        setNotice("Word document exported.");
      }
    } catch (exportError) {
      setError(exportError.message || "Unable to export this document brief.");
    }
  };

  const brief = selectedDocument?.brief;

  return (
    <div className="documents-workspace">
      <section className="documents-intro">
        <div>
          <p className="documents-kicker">GEMINI DOCUMENT ASSISTANT</p>
          <h2>Turn a long document into a useful brief.</h2>
          <p>Upload a PDF or Word file to generate a clear summary, key dates, actions, and risks.</p>
        </div>
        <span className="documents-ai-mark" aria-hidden="true">G</span>
      </section>

      {error && <div className="workspace-error documents-feedback" role="alert">{error}</div>}
      {notice && <div className="workspace-success documents-feedback" role="status">{notice}</div>}
      {!canCreateBrief && (
        <div className="calendar-notice documents-feedback" role="status">
          You can view saved briefs, but your role does not have Documents: Create permission. Ask an administrator to enable it if you need to generate briefs.
        </div>
      )}

      <div className="documents-columns">
        {canCreateBrief && (
          <section className="documents-panel">
            <div className="documents-panel-heading">
              <p className="documents-kicker">CREATE A BRIEF</p>
              <h3>Upload source document</h3>
              <p>Accepted formats: PDF and Word (.docx), up to 10 MB.</p>
            </div>
            <form className="document-upload-form" onSubmit={handleSubmit}>
              <label className="document-file-picker" htmlFor="document-file">
                <span className="document-upload-icon" aria-hidden="true">↑</span>
                <strong>{file ? file.name : "Choose a document"}</strong>
                <span>{file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "Select or drag in a PDF or .docx file"}</span>
                <input
                  id="document-file"
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
              </label>
              <label className="document-context-field" htmlFor="document-context">
                What should the brief focus on? <span>(optional)</span>
                <textarea
                  id="document-context"
                  rows="3"
                  maxLength="2000"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="For example, summarize the proposed policy and list deadlines."
                />
              </label>
              <p className="document-privacy-note">The file is sent to Google Gemini for analysis. The original file is not retained by this app; the generated brief is saved.</p>
              <button className="primary-action document-submit-button" type="submit" disabled={!file || isSubmitting}>
                {isSubmitting ? "Generating brief..." : "Generate document brief"}
              </button>
            </form>
          </section>
        )}

        <section className="documents-panel saved-briefs-panel">
          <div className="documents-panel-heading saved-briefs-heading">
            <div><p className="documents-kicker">SAVED BRIEFS</p><h3>Your document workspace</h3></div>
            <button className="access-icon-button" type="button" onClick={refreshDocuments} disabled={isLoading} aria-label="Refresh briefs">↻</button>
          </div>
          {isLoading ? (
            <div className="access-loading"><span className="small-spinner" /> Loading saved briefs...</div>
          ) : documents.length === 0 ? (
            <div className="calendar-empty"><span aria-hidden="true">▤</span><strong>No document briefs yet</strong><p>Generated briefs will appear here.</p></div>
          ) : (
            <div className="document-brief-list">
              {documents.map((document) => (
                <div
                  className={`meeting-material-row ${selectedDocument?.id === document.id ? "active" : ""}`}
                  key={document.id}
                >
                  <button
                    className="meeting-material-select"
                    type="button"
                    aria-pressed={selectedDocument?.id === document.id}
                    onClick={() => setSelectedDocument(document)}
                  >
                    <span className="document-brief-icon" aria-hidden="true">▤</span>
                    <span><strong>{document.title}</strong><small>{document.sourceFilename} · {document.status}</small></span>
                  </button>
                  <div className="meeting-material-actions">
                    <button
                      className="meeting-material-action export"
                      type="button"
                      onClick={() => handleExportDocument(document, "pdf")}
                    >
                      Export
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {brief && (
        <article className="document-brief-result">
          <div className="document-result-heading">
            <div><p className="documents-kicker">GENERATED BRIEF</p><h3>{brief.title || selectedDocument.title}</h3><span>{selectedDocument.sourceFilename}</span></div>
            <div className="document-result-actions standard-export-actions">
              <span className={`status-badge status-${selectedDocument.status?.toLowerCase()}`}>{selectedDocument.status}</span>
              <button
                className="meeting-material-action export document-export-button"
                type="button"
                onClick={() => handleExportDocument(selectedDocument, "pdf")}
              >
                <span className="meeting-export-icon" aria-hidden="true">↓</span>
                Export PDF
              </button>
              <button
                className="meeting-material-action export"
                type="button"
                onClick={() => handleExportDocument(selectedDocument, "word")}
              >
                <span className="agenda-word-icon" aria-hidden="true">W</span>
                Export Word
              </button>
            </div>
          </div>
          <section><h4>Executive summary</h4><p>{brief.executiveSummary}</p></section>
          {brief.keyPoints?.length > 0 && <BriefList title="Key points" items={brief.keyPoints} />}
          {brief.dates?.length > 0 && <BriefList title="Important dates" items={brief.dates} />}
          {brief.actions?.length > 0 && (
            <section>
              <h4>Follow-up actions</h4>
              <ul className="brief-action-list">
                {brief.actions.map((action, index) => (
                  <li key={`${action.task}-${index}`}><strong>{action.task}</strong><span>{[action.owner, action.dueDate].filter(Boolean).join(" · ") || "Owner or due date not specified"}</span></li>
                ))}
              </ul>
            </section>
          )}
          {brief.risks?.length > 0 && <BriefList title="Risks and open questions" items={brief.risks} />}
        </article>
      )}
    </div>
  );
}

function BriefList({ title, items }) {
  return (
    <section>
      <h4>{title}</h4>
      <ul className="document-brief-bullets">{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
    </section>
  );
}

function escapeDocumentExportHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getDocumentExportHtml(document) {
  const brief = document.brief || {};
  const actionItems = Array.isArray(brief.actions)
    ? brief.actions.map((action) => [
      action.task,
      action.owner ? `Owner: ${action.owner}` : "",
      action.dueDate ? `Due: ${action.dueDate}` : ""
    ].filter(Boolean).join(" · "))
    : [];
  const listSection = (title, items) => (
    Array.isArray(items) && items.length
      ? `<section class="content-card"><h3>${escapeDocumentExportHtml(title)}</h3><ul>${items.map((item) => `<li>${escapeDocumentExportHtml(item)}</li>`).join("")}</ul></section>`
      : ""
  );
  const sections = [
    brief.executiveSummary
      ? `<section class="content-card summary-card"><h3>Executive summary</h3><p>${escapeDocumentExportHtml(brief.executiveSummary)}</p></section>`
      : "",
    listSection("Key points", brief.keyPoints),
    listSection("Important dates", brief.dates),
    listSection("Follow-up actions", actionItems),
    listSection("Risks and open questions", brief.risks)
  ].join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeDocumentExportHtml(document.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@100..900&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:10mm 12mm 12mm}
*{box-sizing:border-box}
body{font-family:"Noto Sans Khmer",sans-serif;color:#26384a;line-height:1.42;margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:186mm;margin:0 auto;padding:5mm 0 4mm;background:#fff}
.top-rule{height:4px;margin:0 0 10px;border-top:3px solid #1c6678;border-right:62mm solid #d4a94a;border-bottom:1px solid #2d8c80}
.document-header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;padding:3px 0 12px;border-bottom:1px solid #dce6e8}
.brand{font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#3f7772}
.brand-line{display:block;width:34px;height:3px;margin-top:5px;border-radius:2px;background:#d2ac55}
.document-no{text-align:right;color:#7a8b94;font-size:8px;letter-spacing:.5px}
.document-no strong{display:block;margin-top:2px;color:#435966;font-size:9px}
.title-panel{margin:12px 0 10px;padding:15px 18px 14px;border-left:5px solid #2b8176;border-radius:0 8px 8px 0;background:#edf6f4}
.title-panel .eyebrow{margin:0 0 5px;color:#6a7d7e;font-size:8px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase}
.title-panel h1{margin:0;color:#173b55;font-family:"Noto Sans Khmer",sans-serif;font-size:22px;line-height:1.35;letter-spacing:0}
.meta-strip{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 11px}
.meta-item{display:inline-flex;align-items:center;min-height:23px;padding:4px 8px;border:1px solid #dde8e7;border-radius:999px;background:#fff;color:#62777a;font-size:9px}
.meta-item strong{margin-right:5px;color:#315f66;font-size:8px;text-transform:uppercase;letter-spacing:.6px}
.section-heading{display:flex;align-items:center;gap:8px;margin:11px 0 7px;color:#244c5c}
.section-heading:before{content:"";width:22px;height:3px;border-radius:2px;background:#d2ac55}
.section-heading h2{margin:0;font-size:11px;letter-spacing:.7px;text-transform:uppercase}
.content-card{margin:0 0 7px;padding:9px 11px;border:1px solid #dfe9e7;border-radius:7px;background:#fff;break-inside:avoid}
.content-card h3{margin:0 0 5px;color:#397268;font-size:11px}
.content-card p,.content-card li{font-size:10.5px}
.content-card p{margin:0;text-align:justify}
.content-card ul{margin:3px 0 1px;padding-left:17px}
.content-card li{margin:3px 0;padding-left:1px}
.content-card li::marker{color:#d1a84f}
.summary-card{border-left:4px solid #78aaa0;background:#fbfdfc}
.footer{display:flex;justify-content:space-between;margin-top:10px;padding-top:6px;border-top:1px solid #dfe7e7;color:#93a2a5;font-size:7.5px}
@media print{body{width:186mm;margin:0 auto}.page{width:186mm;max-width:none;margin:0;padding:0}.content-card{break-inside:avoid}.footer{break-inside:avoid}}
</style></head><body>
<main class="page">
  <div class="top-rule"></div>
  <header class="document-header">
    <div class="brand">University Workflow<span class="brand-line"></span></div>
    <div class="document-no">DOCUMENT BRIEF<strong>${escapeDocumentExportHtml(document.status || "READY")}</strong></div>
  </header>
  <section class="title-panel">
    <p class="eyebrow">Generated document summary</p>
    <h1>${escapeDocumentExportHtml(document.title || brief.title || "Document brief")}</h1>
  </section>
  <div class="meta-strip">
    <span class="meta-item"><strong>Source</strong>${escapeDocumentExportHtml(document.sourceFilename || "Saved document")}</span>
    <span class="meta-item"><strong>Status</strong>${escapeDocumentExportHtml(document.status || "READY")}</span>
  </div>
  <div class="section-heading"><h2>Document analysis</h2></div>
  ${sections}
  <footer class="footer"><span>University Workflow · Document Brief</span><span>Confidential</span></footer>
</main>
</body></html>`;
}

function getDocumentExportFileName(document) {
  const fileName = String(document.title || "document-brief")
    .replace(/[<>:"/\\|?*]/g, "-")
    .split("")
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return fileName || "document-brief";
}

function openDocumentPdf(document) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Allow pop-ups in your browser to export document briefs as PDF.");
  }
  printWindow.document.open();
  printWindow.document.write(getDocumentExportHtml(document));
  printWindow.document.close();
  window.setTimeout(() => {
    if (!printWindow.closed) {
      printWindow.focus();
      printWindow.print();
    }
  }, 500);
}

function downloadDocumentWord(doc) {
  const blob = new Blob(["\ufeff", getDocumentExportHtml(doc)], {
    type: "application/msword;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = `${getDocumentExportFileName(doc)}.doc`;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default Documents;