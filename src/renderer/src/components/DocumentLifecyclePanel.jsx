import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function DocumentLifecyclePanel({ documentType, documentId, documentNumber, onRefresh }) {
  const [timeline, setTimeline] = useState([]);
  const [links, setLinks] = useState([]);
  const [lifecycleStatus, setLifecycleStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    if (!documentType || !documentId) return;
    setLoading(true);
    setError("");
    const [timelineResult, linksResult] = await Promise.all([
      window.api.documents.timeline({ documentType, documentId }),
      window.api.documents.links({ documentType, documentId }),
    ]);
    if (timelineResult.success) setTimeline(timelineResult.data);
    else setError(timelineResult.error);
    if (linksResult.success) {
      setLinks(linksResult.data.links || []);
      setLifecycleStatus(linksResult.data.document?.lifecycleStatus || "");
    }
    setLoading(false);
  }, [documentType, documentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleReverse() {
    const result = await window.api.documents.reverse({
      documentType,
      id: documentId,
      reason: reason || "Document reversed",
    });
    if (!result.success) {
      alert(result.error);
      return;
    }
    await load();
    onRefresh?.();
  }

  async function handleCorrect() {
    const result = await window.api.documents.correct({
      documentType,
      id: documentId,
      reason: reason || "Document correction",
    });
    if (!result.success) {
      alert(result.error);
      return;
    }
    alert(`Correction draft ${result.data.draft.number} created. Edit and post the draft.`);
    await load();
    onRefresh?.();
  }

  async function handleArchive() {
    const result = await window.api.documents.archive({
      documentType,
      id: documentId,
      reason: reason || "Archived",
    });
    if (!result.success) {
      alert(result.error);
      return;
    }
    await load();
    onRefresh?.();
  }

  async function handlePostDraft() {
    const result = await window.api.documents.postDraft({ documentType, id: documentId });
    if (!result.success) {
      alert(result.error);
      return;
    }
    await load();
    onRefresh?.();
  }

  if (!documentId) return null;

  const canReverse = lifecycleStatus === "Posted";
  const canCorrect = lifecycleStatus === "Posted";
  const canArchive = lifecycleStatus === "Cancelled" || lifecycleStatus === "Reversed";
  const canPostDraft = lifecycleStatus === "Draft";

  return (
    <section className="document-card lifecycle-panel">
      <div className="page-header">
        <div>
          <h3>Document Lifecycle</h3>
          <p>
            {documentNumber || `#${documentId}`} · {lifecycleStatus || "—"}
          </p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading ? <p>Loading lifecycle...</p> : null}

      <label>
        Reason / reference
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional reason" />
      </label>

      <div className="table-actions lifecycle-actions">
        {canPostDraft && (
          <button type="button" onClick={handlePostDraft}>
            Post Draft
          </button>
        )}
        {canReverse && (
          <button type="button" className="danger" onClick={handleReverse}>
            Reverse
          </button>
        )}
        {canCorrect && (
          <button type="button" onClick={handleCorrect}>
            Correct Document
          </button>
        )}
        {canArchive && (
          <button type="button" className="secondary" onClick={handleArchive}>
            Archive
          </button>
        )}
      </div>

      <h4>Timeline</h4>
      <ul className="lifecycle-timeline">
        {timeline.map((event) => (
          <li key={event.id}>
            <strong>{event.action}</strong> · {formatDateTime(event.performedAt)}
            {event.reason ? ` · ${event.reason}` : ""}
            {event.performedBy ? ` · ${event.performedBy}` : ""}
          </li>
        ))}
        {timeline.length === 0 && !loading ? <li>No lifecycle events yet.</li> : null}
      </ul>

      <h4>Linked Documents</h4>
      <ul className="lifecycle-links">
        {links.map((link, index) => (
          <li key={`${link.role}-${index}`}>
            {link.documentId && link.route ? (
              <Link to={`${link.route}?id=${link.documentId}`}>
                {link.role}: {link.documentType} #{link.documentId}
              </Link>
            ) : (
              <span>
                {link.role}
                {link.reference ? `: ${link.reference}` : ""}
                {link.date ? ` · ${formatDateTime(link.date)}` : ""}
              </span>
            )}
          </li>
        ))}
        {links.length === 0 && !loading ? <li>No linked documents.</li> : null}
      </ul>
    </section>
  );
}
