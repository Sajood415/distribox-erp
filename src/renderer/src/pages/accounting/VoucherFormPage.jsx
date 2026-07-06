import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { todayInputValue } from "../../utils/purchase";

const VOUCHER_TYPES = [
  "Opening",
  "Payment",
  "Receiving",
  "Journal",
  "BankPayment",
  "BankReceiving",
];

const QUICK_TYPES = ["Payment", "Receiving", "BankPayment", "BankReceiving"];

const ACCOUNT_HINTS = {
  Payment: { debit: "Expense / Accounts Payable", credit: "Cash / Bank" },
  Receiving: { debit: "Cash / Bank", credit: "Accounts Receivable / Income" },
  BankPayment: { debit: "Expense / AP", credit: "Bank" },
  BankReceiving: { debit: "Bank", credit: "AR / Income" },
};

function emptyLine() {
  return { accountId: "", debit: "", credit: "", narrative: "" };
}

export default function VoucherFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("quick");

  const [form, setForm] = useState({
    type: searchParams.get("type") || "Payment",
    date: todayInputValue(),
    description: "",
    amount: "",
    debitAccountId: "",
    creditAccountId: "",
    lines: [emptyLine(), emptyLine()],
  });

  useEffect(() => {
    async function load() {
      const result = await window.api.accounting.lookups();
      if (result.success) {
        setAccounts(result.data.accounts);
        const cash = result.data.accounts.find((a) => a.code === "1100");
        const bank = result.data.accounts.find((a) => a.code === "1200");
        const ap = result.data.accounts.find((a) => a.code === "2100");
        const ar = result.data.accounts.find((a) => a.code === "1400");
        setForm((current) => ({
          ...current,
          debitAccountId: current.type === "Receiving" || current.type === "BankReceiving"
            ? String(bank?.id || cash?.id || "")
            : String(ap?.id || ""),
          creditAccountId: current.type === "Receiving" || current.type === "BankReceiving"
            ? String(ar?.id || "")
            : String(cash?.id || ""),
        }));
      }
      setLoading(false);
    }
    load();
  }, []);

  const totals = useMemo(() => {
    const debit = form.lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
    const credit = form.lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.01 && debit > 0 };
  }, [form.lines]);

  function updateLine(index, key, value) {
    setForm((current) => {
      const lines = [...current.lines];
      lines[index] = { ...lines[index], [key]: value };
      return { ...current, lines };
    });
  }

  function addLine() {
    setForm((current) => ({ ...current, lines: [...current.lines, emptyLine()] }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    let lines = form.lines;

    if (mode === "quick" && QUICK_TYPES.includes(form.type)) {
      const quick = await window.api.accounting.buildQuickLines({
        type: form.type,
        amount: form.amount,
        debitAccountId: form.debitAccountId,
        creditAccountId: form.creditAccountId,
      });
      if (!quick.success) {
        setSaving(false);
        setError(quick.error);
        return;
      }
      lines = quick.data.lines;
    }

    const result = await window.api.accounting.saveVoucher({
      type: form.type,
      date: form.date,
      description: form.description,
      lines,
    });

    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    navigate("/accounting/vouchers");
  }

  if (loading) return <p>Loading accounts...</p>;

  const hints = ACCOUNT_HINTS[form.type];

  return (
    <form className="document-page" onSubmit={handleSubmit}>
      <div className="page-header">
        <div>
          <h2>New Voucher</h2>
          <p>Double-entry voucher with balanced debits and credits</p>
        </div>
        <Link to="/accounting/vouchers" className="secondary-link">
          Back to list
        </Link>
      </div>

      <section className="document-card">
        <div className="document-grid">
          <label>
            Voucher Type
            <select
              value={form.type}
              onChange={(e) =>
                setForm({
                  ...form,
                  type: e.target.value,
                })
              }
            >
              {VOUCHER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>
          <label className="span-2">
            Description
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
        </div>

        <div className="filter-bar">
          <button type="button" className={mode === "quick" ? "" : "secondary"} onClick={() => setMode("quick")}>
            Quick Entry
          </button>
          <button type="button" className={mode === "journal" ? "" : "secondary"} onClick={() => setMode("journal")}>
            Full Journal
          </button>
        </div>
      </section>

      {mode === "quick" && QUICK_TYPES.includes(form.type) ? (
        <section className="document-card">
          <div className="document-grid">
            <label>
              Debit Account ({hints?.debit})
              <select
                value={form.debitAccountId}
                onChange={(e) => setForm({ ...form, debitAccountId: e.target.value })}
                required
              >
                <option value="">Select</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Credit Account ({hints?.credit})
              <select
                value={form.creditAccountId}
                onChange={(e) => setForm({ ...form, creditAccountId: e.target.value })}
                required
              >
                <option value="">Select</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </label>
          </div>
        </section>
      ) : (
        <section className="document-card">
          <div className="section-toolbar">
            <h3>Journal Lines</h3>
            <button type="button" className="secondary" onClick={addLine}>
              Add Line
            </button>
          </div>
          {form.lines.map((line, index) => (
            <div key={index} className="journal-line">
              <select
                value={line.accountId}
                onChange={(e) => updateLine(index, "accountId", e.target.value)}
                required
              >
                <option value="">Account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Debit"
                value={line.debit}
                onChange={(e) => updateLine(index, "debit", e.target.value)}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Credit"
                value={line.credit}
                onChange={(e) => updateLine(index, "credit", e.target.value)}
              />
              <input
                placeholder="Narrative"
                value={line.narrative}
                onChange={(e) => updateLine(index, "narrative", e.target.value)}
              />
            </div>
          ))}
          <div className="totals-grid compact">
            <span>Total Debit</span>
            <strong>{totals.debit.toFixed(2)}</strong>
            <span>Total Credit</span>
            <strong>{totals.credit.toFixed(2)}</strong>
            <span>Status</span>
            <strong className={totals.balanced ? "success-text" : "warning-text"}>
              {totals.balanced ? "Balanced" : "Not balanced"}
            </strong>
          </div>
        </section>
      )}

      {error && <p className="error-text">{error}</p>}

      <div className="document-actions">
        <button type="submit" disabled={saving || (mode === "journal" && !totals.balanced)}>
          {saving ? "Saving..." : "Save Voucher"}
        </button>
      </div>
    </form>
  );
}
