import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function BackupPage() {
  const [localBackups, setLocalBackups] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadBackups() {
    setLoading(true);
    const result = await window.api.tools.listLocalBackups();
    if (result.success) {
      setLocalBackups(result.data.rows);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadBackups();
  }, []);

  async function runAction(action) {
    setBusy(true);
    setError("");
    setMessage("");
    const result = await action();
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setMessage(
      result.data.backupDir
        ? `Backup saved to ${result.data.backupDir}`
        : `Restore completed. ${result.data.companies ?? 0} companies restored.`
    );
    await loadBackups();
  }

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Backup & Restore</h2>
          <p>Copy master and company SQLite databases to a safe location</p>
        </div>
        <Link to="/tools" className="secondary-link">
          All Tools
        </Link>
      </div>

      <section className="document-card">
        <h3>Create Backup</h3>
        <p className="hint-text">
          Quick backup saves inside the app data folder. External backup lets you choose any folder (USB, network drive,
          etc.).
        </p>
        <div className="document-actions">
          <button type="button" disabled={busy} onClick={() => runAction(() => window.api.tools.backupLocal())}>
            Quick Backup
          </button>
          <button type="button" className="secondary" disabled={busy} onClick={() => runAction(() => window.api.tools.backup())}>
            Backup to Folder...
          </button>
        </div>
      </section>

      <section className="document-card">
        <h3>Restore Backup</h3>
        <p className="hint-text warning-text">
          Restore replaces current database files. Make a backup first if you are unsure.
        </p>
        <div className="document-actions">
          <button type="button" className="danger" disabled={busy} onClick={() => runAction(() => window.api.tools.restore())}>
            Restore from Folder...
          </button>
        </div>
      </section>

      {message && <p className="success-text">{message}</p>}
      {error && <p className="error-text">{error}</p>}

      <section className="document-card">
        <h3>Recent Quick Backups</h3>
        {loading ? (
          <p>Loading...</p>
        ) : localBackups.length === 0 ? (
          <p className="hint-text">No quick backups yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Folder</th>
                <th>Created</th>
                <th>Companies</th>
              </tr>
            </thead>
            <tbody>
              {localBackups.map((row) => (
                <tr key={row.path}>
                  <td>{row.name}</td>
                  <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</td>
                  <td>{row.companies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
