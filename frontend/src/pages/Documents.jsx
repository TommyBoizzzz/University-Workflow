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
                <button
                  className={`document-brief-choice ${selectedDocument?.id === document.id ? "active" : ""}`}
                  key={document.id}
                  type="button"
                  onClick={() => setSelectedDocument(document)}
                >
                  <span className="document-brief-icon" aria-hidden="true">▤</span>
                  <span><strong>{document.title}</strong><small>{document.sourceFilename} · {document.status}</small></span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {brief && (
        <article className="document-brief-result">
          <div className="document-result-heading">
            <div><p className="documents-kicker">GENERATED BRIEF</p><h3>{brief.title || selectedDocument.title}</h3><span>{selectedDocument.sourceFilename}</span></div>
            <span className={`status-badge status-${selectedDocument.status?.toLowerCase()}`}>{selectedDocument.status}</span>
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

export default Documents;