import { useEffect, useState } from "react";

const SETTING_GROUPS = [
  {
    title: "Company",
    keys: [
      { key: "company_name", label: "Company Name" },
      { key: "company_address", label: "Address" },
      { key: "company_city", label: "City" },
      { key: "company_phone", label: "Phone" },
      { key: "company_ntn", label: "NTN" },
      { key: "company_strn", label: "STRN" },
    ],
  },
  {
    title: "Fiscal Year",
    keys: [
      { key: "fiscal_year_start_month", label: "Fiscal Year Start Month (1-12)", type: "number" },
      { key: "date_format", label: "Date Format" },
      { key: "currency_symbol", label: "Currency Symbol" },
    ],
  },
  {
    title: "Tax & Pricing",
    keys: [
      { key: "pricing_mode", label: "Pricing Mode (tier / flat)" },
      { key: "tax_mode", label: "Tax Mode (line_vat)" },
      { key: "default_vat_percent", label: "Default VAT %", type: "number" },
      { key: "default_payment_terms", label: "Default Payment Terms (days)", type: "number" },
    ],
  },
  {
    title: "Sales Policies",
    keys: [
      {
        key: "credit_limit_policy",
        label: "Credit Limit Policy (WARN / BLOCK)",
      },
    ],
  },
  {
    title: "Stock Policies",
    keys: [
      { key: "allow_negative_stock", label: "Allow Negative Stock (true/false)" },
      { key: "halt_on_expiry", label: "Halt Sales on Expiry (true/false)" },
    ],
  },
  {
    title: "Backup",
    keys: [
      { key: "auto_backup_enabled", label: "Auto Backup Enabled (true/false)" },
      { key: "auto_backup_hour", label: "Auto Backup Hour (0-23)", type: "number" },
      { key: "backup_retention_days", label: "Backup Retention Days", type: "number" },
    ],
  },
  {
    title: "Documents",
    keys: [
      { key: "document_show_batch", label: "Show Batch on Invoice (true/false)" },
      { key: "document_show_expiry", label: "Show Expiry on Invoice (true/false)" },
      { key: "invoice_terms_text", label: "Invoice Terms", type: "textarea" },
    ],
  },
  {
    title: "Printing",
    keys: [
      { key: "print_show_logo", label: "Show Logo on Print (true/false)" },
      { key: "print_footer_text", label: "Print Footer Text" },
      { key: "print_page_size", label: "Page Size (A4)" },
    ],
  },
];

const RESET_POLICIES = ["NEVER", "CALENDAR_YEAR", "FISCAL_YEAR"];

const MAPPING_ROLE_LABELS = {
  CASH: "Cash Account",
  BANK: "Bank Account",
  INVENTORY: "Inventory Account",
  ACCOUNTS_RECEIVABLE: "Accounts Receivable",
  ACCOUNTS_PAYABLE: "Accounts Payable",
  SALES_REVENUE: "Sales Revenue",
  SALES_RETURN: "Sales Return",
  TAX_PAYABLE: "Tax Payable",
  FREIGHT_INCOME: "Freight Income",
  PURCHASE_ACCOUNT: "Purchase Account",
  PURCHASE_RETURN: "Purchase Return",
  COGS: "Cost Of Goods Sold",
  INVENTORY_ADJUSTMENT_GAIN: "Inventory Adjustment Gain",
  INVENTORY_ADJUSTMENT_LOSS: "Inventory Adjustment Loss",
  CLAIMS_EXPENSE: "Claims Expense",
  RECOVERY_ACCOUNT: "Recovery Account",
  EQUITY: "Equity",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [sequences, setSequences] = useState([]);
  const [mappings, setMappings] = useState({});
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const [settingsResult, seqResult, mappingsResult, lookupsResult] = await Promise.all([
      window.api.settings.get(),
      window.api.settings.listSequences(),
      window.api.settings.listMappings(),
      window.api.accounting.lookups(),
    ]);
    if (settingsResult.success) {
      setSettings(settingsResult.data.settings);
    }
    if (seqResult.success) {
      setSequences(seqResult.data.rows);
    }
    if (mappingsResult.success) {
      setMappings(mappingsResult.data.mappings);
    }
    if (lookupsResult.success) {
      setAccounts(lookupsResult.data.accounts);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function updateSetting(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function updateSequence(index, field, value) {
    setSequences((current) =>
      current.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  async function handleSaveSettings() {
    setSaving(true);
    setError("");
    setMessage("");
    const result = await window.api.settings.save({ settings });
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSettings(result.data.settings);
    setMessage("Settings saved.");
  }

  async function handleSaveSequences() {
    setSaving(true);
    setError("");
    setMessage("");
    for (const seq of sequences) {
      const result = await window.api.settings.saveSequence(seq);
      if (!result.success) {
        setError(result.error);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setMessage("Numbering settings saved.");
    await load();
  }

  async function handleSaveMapping(role, accountId) {
    setSaving(true);
    setError("");
    setMessage("");
    const result = await window.api.settings.saveMapping({ role, accountId });
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setMappings(result.data.mappings);
    setMessage(`Mapping saved for ${MAPPING_ROLE_LABELS[role] || role}.`);
  }

  if (loading) {
    return <div className="page-center">Loading settings...</div>;
  }

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <p>Company, fiscal year, numbering, stock, tax, backup, and printing preferences</p>
        </div>
      </div>

      {message ? <div className="success-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      {SETTING_GROUPS.map((group) => (
        <section key={group.title} className="document-card">
          <h3>{group.title}</h3>
          <div className="form-grid">
            {group.keys.map((field) => (
              <label key={field.key} className="form-field">
                <span>{field.label}</span>
                {field.type === "textarea" ? (
                  <textarea
                    rows={3}
                    value={settings[field.key] ?? ""}
                    onChange={(e) => updateSetting(field.key, e.target.value)}
                  />
                ) : (
                  <input
                    type={field.type === "number" ? "number" : "text"}
                    value={settings[field.key] ?? ""}
                    onChange={(e) => updateSetting(field.key, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
        </section>
      ))}

      <div className="document-actions">
        <button type="button" onClick={handleSaveSettings} disabled={saving}>
          Save Settings
        </button>
      </div>

      <section className="document-card">
        <h3>Invoice Numbering</h3>
        <p className="hint-text">
          Pakistan distributors typically use fiscal year reset (July–June). Example: SI-000001
        </p>
        <div className="table-wrap">
          <table className="line-items-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Prefix</th>
                <th>Padding</th>
                <th>Reset Policy</th>
                <th>Current #</th>
              </tr>
            </thead>
            <tbody>
              {sequences.map((seq, index) => (
                <tr key={seq.documentType}>
                  <td>{seq.documentType}</td>
                  <td>
                    <input
                      value={seq.prefix}
                      onChange={(e) => updateSequence(index, "prefix", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={3}
                      max={10}
                      value={seq.padding}
                      onChange={(e) => updateSequence(index, "padding", e.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      value={seq.resetPolicy}
                      onChange={(e) => updateSequence(index, "resetPolicy", e.target.value)}
                    >
                      {RESET_POLICIES.map((policy) => (
                        <option key={policy} value={policy}>
                          {policy}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{seq.currentSequence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="document-actions">
          <button type="button" onClick={handleSaveSequences} disabled={saving}>
            Save Numbering
          </button>
        </div>
      </section>

      <section className="document-card">
        <h3>Account Mappings</h3>
        <p className="hint-text">
          Map system roles to chart of accounts. All automatic journal posting uses these mappings.
        </p>
        <div className="table-wrap">
          <table className="line-items-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Current Account</th>
                <th>Change To</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(MAPPING_ROLE_LABELS).map(([role, label]) => {
                const mapping = mappings[role];
                return (
                  <tr key={role}>
                    <td>{label}</td>
                    <td>
                      {mapping
                        ? `${mapping.accountCode} — ${mapping.accountName}`
                        : <span className="hint-text">Not configured</span>}
                    </td>
                    <td>
                      <select
                        defaultValue={mapping?.accountId ?? ""}
                        id={`mapping-${role}`}
                      >
                        <option value="">Select account...</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.code} — {account.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          const select = document.getElementById(`mapping-${role}`);
                          if (select?.value) {
                            handleSaveMapping(role, Number(select.value));
                          }
                        }}
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
