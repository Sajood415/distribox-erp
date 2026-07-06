import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ReportDateRange, { defaultEndDate, defaultStartDate } from "./ReportDateRange";
import { buildStatementPrintHtml } from "../utils/print";

const DOCUMENT_TYPES = [
  { value: "", label: "All Types" },
  { value: "OPENING_BALANCE", label: "Opening Balance" },
  { value: "SALES_INVOICE", label: "Sales Invoice" },
  { value: "SALES_RETURN", label: "Sales Return" },
  { value: "RECOVERY", label: "Recovery" },
  { value: "PURCHASE_INVOICE", label: "Purchase Invoice" },
  { value: "PURCHASE_RETURN", label: "Purchase Return" },
  { value: "VENDOR_PAYMENT", label: "Vendor Payment" },
];

export default function LedgerReportPage({
  title,
  partyLabel,
  partyId,
  setPartyId,
  parties,
  loadLedger,
  backLink = "/reports",
}) {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(defaultStartDate());
  const [endDate, setEndDate] = useState(defaultEndDate());
  const [documentType, setDocumentType] = useState("");
  const [reference, setReference] = useState("");
  const [ledger, setLedger] = useState(null);
  const [companyName, setCompanyName] = useState("Distribox ERP");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const result = await window.api.settings.get();
      if (result.success) {
        setCompanyName(result.data.settings.company_name || "Distribox ERP");
      }
    }
    loadSettings();
  }, []);

  useEffect(() => {
    async function load() {
      if (!partyId) {
        setLedger(null);
        return;
      }
      setLoading(true);
      const result = await loadLedger({
        partyId: Number(partyId),
        startDate,
        endDate,
        documentType: documentType || undefined,
        reference: reference || undefined,
      });
      if (result.success) setLedger(result.data);
      setLoading(false);
    }
    load();
  }, [partyId, startDate, endDate, documentType, reference, loadLedger]);

  async function handlePrint() {
    if (!ledger) return;
    const html = buildStatementPrintHtml({
      companyName,
      partyLabel,
      partyName: `${ledger.party.code} — ${ledger.party.name}`,
      startDate,
      endDate,
      openingBalance: ledger.openingBalance,
      closingBalance: ledger.closingBalance,
      rows: ledger.rows,
    });
    await window.api.tools.printHtml(html);
  }

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>{title}</h2>
          <p>Complete transaction history with running balance</p>
        </div>
        <div className="header-actions-row">
          <Link to={backLink} className="secondary-link">
            All Reports
          </Link>
          {ledger ? (
            <button type="button" onClick={handlePrint}>
              Print Statement
            </button>
          ) : null}
        </div>
      </div>

      <section className="document-card">
        <div className="document-grid">
          <label>
            {partyLabel}
            <select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              <option value="">Select {partyLabel.toLowerCase()}</option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.code} — {party.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Document Type
            <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Reference
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Invoice / voucher #"
            />
          </label>
        </div>
        <ReportDateRange
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
        />
      </section>

      {ledger ? (
        <section className="document-card">
          <div className="summary-cards">
            <article>
              <span>Opening Balance</span>
              <strong>{ledger.openingBalance.toFixed(2)}</strong>
            </article>
            <article>
              <span>Closing Balance</span>
              <strong>{ledger.closingBalance.toFixed(2)}</strong>
            </article>
            <article>
              <span>Operational Outstanding</span>
              <strong>{ledger.operationalOutstanding.toFixed(2)}</strong>
            </article>
            <article>
              <span>GL Control</span>
              <strong>{ledger.glBalance.toFixed(2)}</strong>
            </article>
            <article>
              <span>Reconciled</span>
              <strong>{ledger.matchesOutstanding ? "Yes" : "No"}</strong>
            </article>
          </div>
        </section>
      ) : null}

      {loading ? (
        <p>Loading ledger...</p>
      ) : ledger ? (
        <div className="table-wrap">
          <table className="line-items-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Particulars</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5}>
                  <strong>Opening Balance</strong>
                </td>
                <td>
                  <strong>{ledger.openingBalance.toFixed(2)}</strong>
                </td>
              </tr>
              {ledger.rows.map((row, index) => (
                <tr key={`${row.documentType}-${row.documentId}-${index}`}>
                  <td>{row.date ? new Date(row.date).toLocaleDateString() : "—"}</td>
                  <td>
                    {row.route ? (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => navigate(row.route)}
                      >
                        {row.reference}
                      </button>
                    ) : (
                      row.reference
                    )}
                  </td>
                  <td>{row.description}</td>
                  <td>{row.debit > 0 ? row.debit.toFixed(2) : ""}</td>
                  <td>{row.credit > 0 ? row.credit.toFixed(2) : ""}</td>
                  <td>{row.balance.toFixed(2)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={5}>
                  <strong>Closing Balance</strong>
                </td>
                <td>
                  <strong>{ledger.closingBalance.toFixed(2)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="hint-text">Select a {partyLabel.toLowerCase()} to view the ledger.</p>
      )}
    </div>
  );
}
