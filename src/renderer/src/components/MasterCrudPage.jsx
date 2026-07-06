import { useEffect, useMemo, useState } from "react";
import DataTable from "./DataTable";

function emptyValues(fields) {
  return fields.reduce((acc, field) => {
    if (field.type === "checkbox") {
      acc[field.key] = false;
    } else if (field.type === "number") {
      acc[field.key] = "";
    } else {
      acc[field.key] = "";
    }
    return acc;
  }, {});
}

function FormField({ field, value, onChange, lookups }) {
  if (field.type === "select") {
    const options = field.options ?? lookups[field.optionsKey] ?? [];
    return (
      <label>
        {field.label}
        <select value={value ?? ""} onChange={(e) => onChange(field.key, e.target.value)} required={field.required}>
          <option value="">Select...</option>
          {options.map((option) => (
            <option key={option.id ?? option.value} value={option.id ?? option.value}>
              {option[field.optionLabel] ?? option.name ?? option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(field.key, e.target.checked)}
        />
        {field.label}
      </label>
    );
  }

  return (
    <label>
      {field.label}
      <input
        type={field.type === "number" ? "number" : "text"}
        value={value ?? ""}
        onChange={(e) => onChange(field.key, e.target.value)}
        required={field.required}
      />
    </label>
  );
}

export default function MasterCrudPage({ title, entity, columns, fields, getDefaultRow }) {
  const api = window.api.masters[entity];
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const needsLookups = useMemo(
    () => fields.some((field) => field.type === "select" && field.optionsKey),
    [fields]
  );

  async function loadRows() {
    setLoading(true);
    setError("");
    const result = await api.list();
    if (!result.success) {
      setError(result.error);
      setRows([]);
    } else {
      setRows(result.data);
    }
    setLoading(false);
  }

  useEffect(() => {
    async function init() {
      if (needsLookups) {
        const lookupResult = await window.api.masters.lookups();
        if (lookupResult.success) {
          setLookups(lookupResult.data);
        }
      }
      await loadRows();
    }
    init();
  }, [entity]);

  function openCreate() {
    setForm(getDefaultRow ? getDefaultRow() : emptyValues(fields));
    setModalOpen(true);
  }

  function openEdit(row) {
    const next = { ...row };
    fields.forEach((field) => {
      if (field.type === "select" && next[field.key] != null) {
        next[field.key] = String(next[field.key]);
      }
    });
    setForm(next);
    setModalOpen(true);
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const result = await api.save(form);
    setSaving(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setModalOpen(false);
    await loadRows();
  }

  async function handleDelete(row) {
    if (!window.confirm(`Delete ${row.name || row.code}?`)) {
      return;
    }

    const result = await api.delete(row.id);
    if (!result.success) {
      setError(result.error);
      return;
    }
    await loadRows();
  }

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>{title}</h2>
          <p>{rows.length} records</p>
        </div>
        <button type="button" onClick={openCreate}>
          Add New
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable columns={columns} data={rows} onEdit={openEdit} onDelete={handleDelete} />
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
            <h3>{form.id ? "Edit" : "Add"} {title.slice(0, -1)}</h3>
            <div className="form-grid">
              {fields.map((field) => (
                <FormField
                  key={field.key}
                  field={field}
                  value={form[field.key]}
                  onChange={updateField}
                  lookups={lookups}
                />
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
