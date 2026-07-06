import { useEffect, useMemo, useState } from "react";
import { todayInputValue } from "../../utils/purchase";

export default function StockTakePage() {
  const [lookups, setLookups] = useState({ warehouses: [] });
  const [sheet, setSheet] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [date, setDate] = useState(todayInputValue());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const result = await window.api.inventory.lookups();
      if (result.success) {
        setLookups(result.data);
        if (result.data.warehouses.length > 0) {
          setWarehouseId(String(result.data.warehouses[0].id));
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    async function loadSheet() {
      if (!warehouseId) return;
      const result = await window.api.inventory.getStockTakeSheet(Number(warehouseId));
      if (result.success) {
        setSheet(result.data);
      }
    }
    loadSheet();
  }, [warehouseId]);

  const differences = useMemo(
    () => sheet.filter((row) => Number(row.countedQty) !== Number(row.systemQty)).length,
    [sheet]
  );

  function updateCount(productId, countedQty) {
    setSheet((current) =>
      current.map((row) =>
        row.productId === productId
          ? {
              ...row,
              countedQty,
              difference: Number(countedQty) - Number(row.systemQty),
            }
          : row
      )
    );
  }

  async function handleFinalize(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const result = await window.api.inventory.finalizeStockTake({
      warehouseId: Number(warehouseId),
      date,
      lines: sheet.map((row) => ({
        productId: row.productId,
        countedQty: row.countedQty,
      })),
    });

    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }

    const refresh = await window.api.inventory.getStockTakeSheet(Number(warehouseId));
    if (refresh.success) setSheet(refresh.data);
  }

  if (loading) return <p>Loading stock take...</p>;

  return (
    <form className="master-page" onSubmit={handleFinalize}>
      <div className="page-header">
        <div>
          <h2>Stock Take</h2>
          <p>Compare physical counts with system stock and post adjustments</p>
        </div>
      </div>

      <section className="document-card">
        <div className="document-grid">
          <label>
            Warehouse
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              {lookups.warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <p className="hint-text">{differences} product(s) with differences</p>
      </section>

      <div className="line-items-scroll">
        <table className="line-items-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Product</th>
              <th>Unit</th>
              <th>System Qty</th>
              <th>Counted Qty</th>
              <th>Difference</th>
            </tr>
          </thead>
          <tbody>
            {sheet.map((row) => (
              <tr key={row.productId} className={row.difference !== 0 ? "row-warning" : ""}>
                <td>{row.productCode}</td>
                <td>{row.productName}</td>
                <td>{row.unit}</td>
                <td>{row.systemQty}</td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.countedQty}
                    onChange={(e) => updateCount(row.productId, e.target.value)}
                  />
                </td>
                <td className={row.difference !== 0 ? "warning-text" : ""}>
                  {Number(row.countedQty) - Number(row.systemQty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="document-actions">
        <button type="submit" disabled={saving || differences === 0}>
          {saving ? "Finalizing..." : "Finalize Stock Take"}
        </button>
      </div>
    </form>
  );
}
