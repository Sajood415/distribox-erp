import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const ENTITIES = [
  { id: "products", label: "Products" },
  { id: "customers", label: "Customers" },
  { id: "vendors", label: "Vendors" },
];

export default function ImportExportPage() {
  const [entities, setEntities] = useState([]);
  const [entity, setEntity] = useState("products");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function load() {
      const result = await window.api.tools.exportEntities();
      if (result.success) setEntities(result.data);
    }
    load();
  }, []);

  async function handleExport() {
    setBusy(true);
    setMessage("");
    setErrors([]);
    const result = await window.api.tools.exportCsv(entity);
    setBusy(false);
    if (!result.success) {
      setErrors([result.error]);
      return;
    }
    setMessage(`Exported ${result.data.rowCount} rows to ${result.data.filePath}`);
  }

  async function handleImport() {
    setBusy(true);
    setMessage("");
    setErrors([]);
    const result = await window.api.tools.importCsv(entity);
    setBusy(false);
    if (!result.success) {
      setErrors([result.error]);
      return;
    }
    setMessage(`Imported ${result.data.imported} of ${result.data.total} rows.`);
    if (result.data.errors?.length) {
      setErrors(result.data.errors);
    }
  }

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Import / Export</h2>
          <p>CSV export and import for master data</p>
        </div>
        <Link to="/tools" className="secondary-link">
          All Tools
        </Link>
      </div>

      <section className="document-card">
        <div className="document-grid">
          <label>
            Data Type
            <select value={entity} onChange={(e) => setEntity(e.target.value)}>
              {(entities.length ? entities : ENTITIES.map((item) => item.id)).map((id) => (
                <option key={id} value={id}>
                  {ENTITIES.find((item) => item.id === id)?.label ?? id}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="document-actions">
          <button type="button" disabled={busy} onClick={handleExport}>
            Export CSV...
          </button>
          <button type="button" className="secondary" disabled={busy} onClick={handleImport}>
            Import CSV...
          </button>
        </div>
      </section>

      <section className="document-card">
        <h3>CSV Format Notes</h3>
        <ul className="hint-list">
          <li>Products require a valid unit code (e.g. PC, PK, CTN).</li>
          <li>Codes must be unique — duplicate rows are skipped with an error.</li>
          <li>First row must be column headers matching the export file.</li>
        </ul>
      </section>

      {message && <p className="success-text">{message}</p>}
      {errors.length > 0 && (
        <section className="document-card">
          <h3>Messages</h3>
          <ul className="error-list">
            {errors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
