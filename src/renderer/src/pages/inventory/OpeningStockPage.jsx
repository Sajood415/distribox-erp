import { useEffect, useState } from "react";
import { todayInputValue } from "../../utils/purchase";

export default function OpeningStockPage() {
  const [lookups, setLookups] = useState({ warehouses: [], products: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    date: todayInputValue(),
    warehouseId: "",
    remarks: "",
    lines: [{ productId: "", quantity: 1, costPerUnit: 0, batchNo: "" }],
  });

  useEffect(() => {
    async function load() {
      const result = await window.api.inventory.lookups();
      if (result.success) {
        setLookups(result.data);
        if (result.data.warehouses.length > 0) {
          setForm((current) => ({
            ...current,
            warehouseId: String(result.data.warehouses[0].id),
          }));
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  function updateLine(index, key, value) {
    setForm((current) => {
      const lines = [...current.lines];
      const line = { ...lines[index], [key]: value };
      if (key === "productId") {
        const product = lookups.products.find((p) => String(p.id) === String(value));
        if (product) {
          line.costPerUnit = product.costPrice || 0;
        }
      }
      lines[index] = line;
      return { ...current, lines };
    });
  }

  function addLine() {
    setForm((current) => ({
      ...current,
      lines: [...current.lines, { productId: "", quantity: 1, costPerUnit: 0, batchNo: "" }],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const result = await window.api.inventory.saveOpeningStock({
      ...form,
      warehouseId: Number(form.warehouseId),
      lines: form.lines.map((line) => ({
        ...line,
        productId: Number(line.productId),
      })),
    });

    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }

    setForm((current) => ({
      ...current,
      lines: [{ productId: "", quantity: 1, costPerUnit: 0, batchNo: "" }],
    }));
  }

  if (loading) return <p>Loading...</p>;

  return (
    <form className="document-page" onSubmit={handleSubmit}>
      <div className="page-header">
        <div>
          <h2>Opening Stock</h2>
          <p>Load initial inventory balances and valuation</p>
        </div>
      </div>

      <section className="document-card">
        <div className="document-grid">
          <label>
            Date
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>
          <label>
            Warehouse
            <select
              value={form.warehouseId}
              onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
              required
            >
              {lookups.warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {form.lines.map((line, index) => (
          <div key={index} className="inline-form opening-line">
            <select
              value={line.productId}
              onChange={(e) => updateLine(index, "productId", e.target.value)}
              required
            >
              <option value="">Product</option>
              {lookups.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.code} - {product.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              placeholder="Qty"
              value={line.quantity}
              onChange={(e) => updateLine(index, "quantity", e.target.value)}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Cost"
              value={line.costPerUnit}
              onChange={(e) => updateLine(index, "costPerUnit", e.target.value)}
            />
            <input
              placeholder="Batch"
              value={line.batchNo}
              onChange={(e) => updateLine(index, "batchNo", e.target.value)}
            />
          </div>
        ))}

        <button type="button" className="secondary" onClick={addLine}>
          Add Line
        </button>
      </section>

      {error && <p className="error-text">{error}</p>}

      <div className="document-actions">
        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Opening Stock"}
        </button>
      </div>
    </form>
  );
}
