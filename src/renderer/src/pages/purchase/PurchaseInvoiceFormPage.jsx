import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  calcPurchaseLine,
  calcPurchaseTotals,
  emptyPurchaseLine,
  todayInputValue,
} from "../../utils/purchase";

export default function PurchaseInvoiceFormPage() {
  const navigate = useNavigate();
  const [lookups, setLookups] = useState({ vendors: [], products: [], warehouses: [], units: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    date: todayInputValue(),
    vendorId: "",
    warehouseId: "",
    isCredit: true,
    freight: 0,
    paidAmount: 0,
    remarks: "",
    items: [emptyPurchaseLine()],
  });

  useEffect(() => {
    async function load() {
      const result = await window.api.purchase.lookups();
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

  const totals = useMemo(
    () => calcPurchaseTotals(form.items, form.freight, form.paidAmount),
    [form.items, form.freight, form.paidAmount]
  );

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateLine(index, key, value) {
    setForm((current) => {
      const items = [...current.items];
      const line = { ...items[index], [key]: value };

      if (key === "productId") {
        const product = lookups.products.find((p) => String(p.id) === String(value));
        if (product) {
          line.unitId = String(product.baseUnitId);
          line.price = product.costPrice || product.price1 || 0;
          line.vatPercent = product.vatPercent || 0;
        }
      }

      items[index] = line;
      return { ...current, items };
    });
  }

  function addLine() {
    setForm((current) => ({ ...current, items: [...current.items, emptyPurchaseLine()] }));
  }

  function removeLine(index) {
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const result = await window.api.purchase.saveInvoice({
      ...form,
      vendorId: Number(form.vendorId),
      warehouseId: Number(form.warehouseId),
      items: form.items.map((item) => ({
        ...item,
        productId: Number(item.productId),
        unitId: Number(item.unitId),
      })),
    });

    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }

    navigate("/purchase/invoices");
  }

  if (loading) {
    return <p>Loading purchase form...</p>;
  }

  return (
    <form className="document-page" onSubmit={handleSubmit}>
      <div className="page-header">
        <div>
          <h2>New Purchase Invoice</h2>
          <p>Stock-in, payables, and journal posting on save</p>
        </div>
        <Link to="/purchase/invoices" className="secondary-link">
          Back to list
        </Link>
      </div>

      <section className="document-card">
        <div className="document-grid">
          <label>
            Date
            <input type="date" value={form.date} onChange={(e) => updateField("date", e.target.value)} required />
          </label>
          <label>
            Vendor
            <select value={form.vendorId} onChange={(e) => updateField("vendorId", e.target.value)} required>
              <option value="">Select vendor</option>
              {lookups.vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name} ({vendor.code})
                </option>
              ))}
            </select>
          </label>
          <label>
            Warehouse
            <select
              value={form.warehouseId}
              onChange={(e) => updateField("warehouseId", e.target.value)}
              required
            >
              <option value="">Select warehouse</option>
              {lookups.warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Payment Type
            <select
              value={form.isCredit ? "credit" : "cash"}
              onChange={(e) => updateField("isCredit", e.target.value === "credit")}
            >
              <option value="credit">Credit</option>
              <option value="cash">Cash</option>
            </select>
          </label>
          <label>
            Freight
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.freight}
              onChange={(e) => updateField("freight", e.target.value)}
            />
          </label>
          <label>
            Paid Amount
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.paidAmount}
              onChange={(e) => updateField("paidAmount", e.target.value)}
            />
          </label>
          <label className="span-2">
            Remarks
            <input value={form.remarks} onChange={(e) => updateField("remarks", e.target.value)} />
          </label>
        </div>
      </section>

      <section className="document-card">
        <div className="section-toolbar">
          <h3>Line Items</h3>
          <button type="button" className="secondary" onClick={addLine}>
            Add Line
          </button>
        </div>

        <div className="line-items-scroll">
          <table className="line-items-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Unit</th>
                <th>Qty</th>
                <th>Free</th>
                <th>Price</th>
                <th>Disc %</th>
                <th>VAT %</th>
                <th>Batch</th>
                <th>Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {form.items.map((line, index) => {
                const { lineTotal } = calcPurchaseLine(line);
                return (
                  <tr key={index}>
                    <td>
                      <select
                        value={line.productId}
                        onChange={(e) => updateLine(index, "productId", e.target.value)}
                        required
                      >
                        <option value="">Select</option>
                        {lookups.products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.code} - {product.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select value={line.unitId} onChange={(e) => updateLine(index, "unitId", e.target.value)}>
                        <option value="">Unit</option>
                        {lookups.units.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.code}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, "quantity", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.freeQuantity}
                        onChange={(e) => updateLine(index, "freeQuantity", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.price}
                        onChange={(e) => updateLine(index, "price", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.discount}
                        onChange={(e) => updateLine(index, "discount", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.vatPercent}
                        onChange={(e) => updateLine(index, "vatPercent", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        value={line.batchNo}
                        onChange={(e) => updateLine(index, "batchNo", e.target.value)}
                      />
                    </td>
                    <td className="amount-cell">{lineTotal.toFixed(2)}</td>
                    <td>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => removeLine(index)}
                        disabled={form.items.length === 1}
                      >
                        X
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="document-card totals-card">
        <div className="totals-grid">
          <span>Subtotal</span>
          <strong>{totals.subtotal.toFixed(2)}</strong>
          <span>Tax</span>
          <strong>{totals.taxTotal.toFixed(2)}</strong>
          <span>Freight</span>
          <strong>{Number(form.freight || 0).toFixed(2)}</strong>
          <span>Grand Total</span>
          <strong>{totals.total.toFixed(2)}</strong>
          <span>Outstanding</span>
          <strong>{totals.outstanding.toFixed(2)}</strong>
        </div>
      </section>

      {error && <p className="error-text">{error}</p>}

      <div className="document-actions">
        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Purchase Invoice"}
        </button>
      </div>
    </form>
  );
}
