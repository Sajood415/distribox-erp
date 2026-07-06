import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ReportDateRange, { defaultEndDate, defaultStartDate } from "./ReportDateRange";

const MOVEMENT_TYPES = [
  { value: "", label: "All Types" },
  { value: "OPENING_STOCK", label: "Opening Stock" },
  { value: "PURCHASE", label: "Purchase" },
  { value: "PURCHASE_RETURN", label: "Purchase Return" },
  { value: "SALES", label: "Sales" },
  { value: "SALES_RETURN", label: "Sales Return" },
  { value: "POSITIVE_ADJUSTMENT", label: "Positive Adjustment" },
  { value: "NEGATIVE_ADJUSTMENT", label: "Negative Adjustment" },
  { value: "CLAIM_WRITEOFF", label: "Claim Writeoff" },
  { value: "STOCK_TRANSFER", label: "Stock Transfer" },
];

export default function StockLedgerReportPage({
  title,
  description,
  loadLedger,
  filters,
  setFilters,
  lookups,
  backLink = "/inventory/reports",
}) {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(defaultStartDate());
  const [endDate, setEndDate] = useState(defaultEndDate());
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      if (!filters.ready) {
        setLedger(null);
        return;
      }
      setLoading(true);
      const result = await loadLedger({
        ...filters.values,
        startDate,
        endDate,
        movementType: filters.values.movementType || undefined,
        reference: filters.values.reference || undefined,
      });
      if (result.success) setLedger(result.data);
      setLoading(false);
    }
    load();
  }, [filters, startDate, endDate, loadLedger]);

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <Link to={backLink} className="secondary-link">
          Inventory Reports
        </Link>
      </div>

      <section className="document-card">
        <div className="document-grid">
          {filters.fields}
          <label>
            Movement Type
            <select
              value={filters.values.movementType || ""}
              onChange={(e) => filters.setValue("movementType", e.target.value)}
            >
              {MOVEMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Reference
            <input
              value={filters.values.reference || ""}
              onChange={(e) => filters.setValue("reference", e.target.value)}
              placeholder="Document #"
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
              <span>Opening Qty</span>
              <strong>{(ledger.openingQty || 0).toFixed(2)}</strong>
            </article>
            <article>
              <span>Closing Qty</span>
              <strong>{(ledger.closingQty || 0).toFixed(2)}</strong>
            </article>
            <article>
              <span>Actual On Hand</span>
              <strong>{(ledger.actualQty ?? 0).toFixed(2)}</strong>
            </article>
            {ledger.matchesStock != null ? (
              <article>
                <span>Reconciled</span>
                <strong>{ledger.matchesStock ? "Yes" : "No"}</strong>
              </article>
            ) : null}
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
                <th>Type</th>
                <th>Product</th>
                <th>Warehouse</th>
                <th>Batch</th>
                <th>In</th>
                <th>Out</th>
                <th>Balance</th>
                <th>Unit Cost</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={8}>
                  <strong>Opening Balance</strong>
                </td>
                <td>
                  <strong>{(ledger.openingQty || 0).toFixed(2)}</strong>
                </td>
                <td />
                <td>
                  <strong>{(ledger.openingValue || 0).toFixed(2)}</strong>
                </td>
              </tr>
              {ledger.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.date ? new Date(row.date).toLocaleDateString() : "—"}</td>
                  <td>
                    {row.route ? (
                      <button type="button" className="link-button" onClick={() => navigate(row.route)}>
                        {row.referenceNumber}
                      </button>
                    ) : (
                      row.referenceNumber
                    )}
                  </td>
                  <td>{row.movementType}</td>
                  <td>{row.productCode ? `${row.productCode} — ${row.productName}` : "—"}</td>
                  <td>{row.warehouseName || "—"}</td>
                  <td>{row.batchNo || "—"}</td>
                  <td>{row.quantityIn > 0 ? row.quantityIn.toFixed(2) : ""}</td>
                  <td>{row.quantityOut > 0 ? row.quantityOut.toFixed(2) : ""}</td>
                  <td>{(row.balanceQty ?? row.runningQuantity ?? 0).toFixed(2)}</td>
                  <td>{row.unitCost.toFixed(2)}</td>
                  <td>{(row.balanceValue ?? row.runningInventoryValue ?? 0).toFixed(2)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={8}>
                  <strong>Closing Balance</strong>
                </td>
                <td>
                  <strong>{(ledger.closingQty || 0).toFixed(2)}</strong>
                </td>
                <td />
                <td>
                  <strong>{(ledger.closingValue || 0).toFixed(2)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="hint-text">{filters.hint || "Select filters to view the ledger."}</p>
      )}
    </div>
  );
}
