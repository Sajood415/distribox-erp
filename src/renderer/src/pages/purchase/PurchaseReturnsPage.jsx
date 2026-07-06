import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable";
import useDocIdHighlight from "../../hooks/useDocIdHighlight";
import {
  calcPurchaseLine,
  calcPurchaseTotals,
  emptyPurchaseLine,
  todayInputValue,
} from "../../utils/purchase";

const listColumns = [
  { accessorKey: "number", header: "Return #" },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
  },
  {
    accessorKey: "vendor",
    header: "Vendor",
    cell: ({ row }) => row.original.vendor?.name ?? "-",
  },
  { accessorKey: "total", header: "Total" },
];

export default function PurchaseReturnsPage() {
  const highlightRowId = useDocIdHighlight();
  const [lookups, setLookups] = useState({ vendors: [], products: [], warehouses: [], units: [] });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: todayInputValue(),
    vendorId: "",
    warehouseId: "",
    remarks: "",
    items: [{ ...emptyPurchaseLine(), freeQuantity: 0 }],
  });

  const totals = calcPurchaseTotals(form.items.map((item) => ({ ...item, freeQuantity: 0 })));

  async function loadData() {
    const [lookupResult, listResult] = await Promise.all([
      window.api.purchase.lookups(),
      window.api.purchase.listReturns(),
    ]);
    if (lookupResult.success) {
      setLookups(lookupResult.data);
    }
    if (listResult.success) {
      setRows(listResult.data);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateLine(index, key, value) {
    setForm((current) => {
      const items = [...current.items];
      const line = { ...items[index], [key]: value };
      if (key === "productId") {
        const product = lookups.products.find((p) => String(p.id) === String(value));
        if (product) {
          line.unitId = String(product.baseUnitId);
          line.price = product.costPrice || 0;
          line.vatPercent = product.vatPercent || 0;
        }
      }
      items[index] = line;
      return { ...current, items };
    });
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const result = await window.api.purchase.saveReturn({
      ...form,
      vendorId: Number(form.vendorId),
      warehouseId: Number(form.warehouseId),
      items: form.items.map((item) => ({
        ...item,
        productId: Number(item.productId),
        unitId: Number(item.unitId),
        freeQuantity: 0,
      })),
    });

    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }

    setShowForm(false);
    setForm({
      date: todayInputValue(),
      vendorId: "",
      warehouseId: "",
      remarks: "",
      items: [{ ...emptyPurchaseLine(), freeQuantity: 0 }],
    });
    await loadData();
  }

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Purchase Returns</h2>
          <p>Return goods to supplier and reduce stock</p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Hide Form" : "New Return"}
        </button>
      </div>

      {showForm && (
        <form className="document-card" onSubmit={handleSave}>
          <div className="document-grid">
            <label>
              Date
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </label>
            <label>
              Vendor
              <select
                value={form.vendorId}
                onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
                required
              >
                <option value="">Select vendor</option>
                {lookups.vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Warehouse
              <select
                value={form.warehouseId}
                onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
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
          </div>

          {form.items.map((line, index) => (
            <div key={index} className="inline-form">
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
                value={line.quantity}
                onChange={(e) => updateLine(index, "quantity", e.target.value)}
              />
              <input
                type="number"
                min="0"
                value={line.price}
                onChange={(e) => updateLine(index, "price", e.target.value)}
              />
              <span className="amount-cell">{calcPurchaseLine({ ...line, freeQuantity: 0 }).lineTotal.toFixed(2)}</span>
            </div>
          ))}

          <div className="totals-grid compact">
            <span>Return Total</span>
            <strong>{totals.total.toFixed(2)}</strong>
          </div>

          <div className="document-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Return"}
            </button>
          </div>
        </form>
      )}

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={listColumns}
          data={rows}
          showActions={false}
          searchPlaceholder="Search returns..."
          highlightRowId={highlightRowId}
        />
      )}
    </div>
  );
}
