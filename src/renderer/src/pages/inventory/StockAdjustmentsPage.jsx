import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable";
import DocumentLifecyclePanel from "../../components/DocumentLifecyclePanel";
import { lifecycleStatusColumn } from "../../utils/document-lifecycle-columns";
import { todayInputValue } from "../../utils/purchase";

const columns = [
  { accessorKey: "number", header: "Ref #" },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
  },
  { accessorKey: "type", header: "Type" },
  {
    accessorKey: "product",
    header: "Product",
    cell: ({ row }) => row.original.product?.name ?? "-",
  },
  {
    accessorKey: "warehouse",
    header: "Warehouse",
    cell: ({ row }) => row.original.warehouse?.name ?? "-",
  },
  { accessorKey: "quantityChange", header: "Change" },
  { accessorKey: "valueChange", header: "Value" },
  lifecycleStatusColumn,
];

export default function StockAdjustmentsPage() {
  const [lookups, setLookups] = useState({ warehouses: [], products: [] });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: todayInputValue(),
    warehouseId: "",
    productId: "",
    quantityChange: "",
    batchNo: "",
    reason: "",
  });

  async function loadData() {
    const [lookupResult, listResult] = await Promise.all([
      window.api.inventory.lookups(),
      window.api.inventory.listAdjustments(),
    ]);
    if (lookupResult.success) setLookups(lookupResult.data);
    if (listResult.success) setRows(listResult.data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const result = await window.api.inventory.saveAdjustment({
      ...form,
      warehouseId: Number(form.warehouseId),
      productId: Number(form.productId),
    });

    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }

    setShowForm(false);
    await loadData();
  }

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Stock Adjustments</h2>
          <p>Manual corrections for damage, expiry, or warehouse fixes</p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Hide Form" : "New Adjustment"}
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
              Warehouse
              <select
                value={form.warehouseId}
                onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
                required
              >
                <option value="">Select</option>
                {lookups.warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Product
              <select
                value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
                required
              >
                <option value="">Select</option>
                {lookups.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Qty Change (+/-)
              <input
                type="number"
                step="0.01"
                value={form.quantityChange}
                onChange={(e) => setForm({ ...form, quantityChange: e.target.value })}
                required
              />
            </label>
            <label>
              Batch
              <input value={form.batchNo} onChange={(e) => setForm({ ...form, batchNo: e.target.value })} />
            </label>
            <label>
              Reason
              <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </label>
          </div>
          <div className="document-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Adjustment"}
            </button>
          </div>
        </form>
      )}

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          showActions={false}
          searchPlaceholder="Search adjustments..."
          onRowClick={setSelected}
        />
      )}
      {selected && (
        <DocumentLifecyclePanel
          documentType="STOCK_ADJUSTMENT"
          documentId={selected.id}
          documentNumber={selected.number}
          onRefresh={loadData}
        />
      )}
    </div>
  );
}
