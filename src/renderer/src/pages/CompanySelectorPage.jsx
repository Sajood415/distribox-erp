import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function CompanySelectorPage() {
  const { user, selectCompany } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [selectedId, setSelectedId] = useState(user?.companyId ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    async function loadCompanies() {
      const result = await window.api.company.list();
      if (result.success) {
        setCompanies(result.data);
        if (!selectedId && result.data.length > 0) {
          setSelectedId(result.data[0].id);
        }
      }
      setLoading(false);
    }

    loadCompanies();
  }, []);

  async function handleOpen() {
    if (!selectedId) {
      setError("Select a company to continue");
      return;
    }

    setError("");
    setOpening(true);
    const result = await selectCompany(selectedId);
    setOpening(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    navigate("/dashboard");
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError("");

    const result = await window.api.company.create({
      name: newName,
      code: newCode,
    });

    if (!result.success) {
      setError(result.error);
      return;
    }

    setCompanies((current) => [...current, result.data].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedId(result.data.id);
    setNewName("");
    setNewCode("");
    setShowCreate(false);
  }

  if (loading) {
    return <div className="page-center">Loading companies...</div>;
  }

  return (
    <div className="auth-page">
      <div className="company-selector-card">
        <div className="company-selector-header">
          <h1>Select Company</h1>
          <p>Choose which company database to open</p>
        </div>

        {companies.length === 0 ? (
          <div className="company-empty">
            <p>No companies found. Create your first company to get started.</p>
          </div>
        ) : (
          <div className="company-table">
            <div className="company-table-head">
              <span>Company Name</span>
              <span>Code</span>
              <span>Database</span>
            </div>
            <div className="company-table-body">
              {companies.map((company) => {
                const selected = selectedId === company.id;
                return (
                  <button
                    key={company.id}
                    type="button"
                    className={`company-row${selected ? " selected" : ""}`}
                    onClick={() => setSelectedId(company.id)}
                    onDoubleClick={handleOpen}
                  >
                    <span className="company-row-name">
                      <span className={`company-radio${selected ? " checked" : ""}`} aria-hidden="true" />
                      <strong>{company.name}</strong>
                    </span>
                    <span className="company-code-badge">{company.code}</span>
                    <span className="company-db-file">{company.dbFile}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {showCreate && (
          <form className="company-create-panel" onSubmit={handleCreate}>
            <h3>New Company</h3>
            <div className="company-create-fields">
              <label>
                Company Name
                <input
                  placeholder="e.g. Autobiz Unihut"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </label>
              <label>
                Company Code
                <input
                  placeholder="e.g. UNIHUT"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  required
                />
              </label>
            </div>
            <div className="company-create-actions">
              <button type="submit">Create Company</button>
              <button type="button" className="secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && <p className="error-text">{error}</p>}

        <div className="company-selector-footer">
          <button type="button" className="secondary" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Hide Form" : "New Company"}
          </button>
          <button type="button" onClick={handleOpen} disabled={!selectedId || opening}>
            {opening ? "Opening..." : "Open Company"}
          </button>
        </div>
      </div>
    </div>
  );
}
