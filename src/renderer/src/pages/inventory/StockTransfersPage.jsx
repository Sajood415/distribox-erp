import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable";
import { todayInputValue } from "../../utils/purchase";

const listColumns = [
  { accessorKey: "number", header: "Transfer #" },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
  },
  {
    accessorKey: "fromWarehouse",
    header: "From",
    cell: ({ row }) => row.original.fromWarehouse?.name ?? "-",
  },
  {
    accessorKey: "toWarehouse",
    header: "To",
    cell: ({ row }) => row.original.toWarehouse?.name ?? "-",
  },
  {
    accessorKey: "items",
    header: "Lines",
    cell: ({ row }) => row.original.items?.length ?? 0,
  },
];

export default function StockTransfersPage() {
  const [lookups, setLookups] = useState({ warehouses: [], products: [] });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    date: todayInputValue(),
    fromWarehouseId: "",
    toWarehouseId: "",
    remarks: "",
    items: [{ productId: "", quantity: 1 }],
  });

  async function loadData() {
    const [lookupResult, listResult] = await Promise.all([
      window.api.inventory.lookups(),
      window.api.inventory.listTransfers(),
    ]);
    if (lookupResult.success) setLookups(lookupResult.data);
    if (listResult.success) setRows(listResult.data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateLine(index, key, value) {
    setForm((current) => {
      const items = [...current.items];
      items[index] = { ...items[index], [key]: value };
      return { ...current, items };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const result = await window.api.inventory.saveTransfer({
      ...form,
      fromWarehouseId: Number(form.fromWarehouseId),
      toWarehouseId: Number(form.toWarehouseId),
      items: form.items.map((item) => ({
        ...item,
        productId: Number(item.productId),
      })),
    });

    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }

    setForm({
      date: todayInputValue(),
      fromWarehouseId: "",
      toWarehouseId: "",
      remarks: "",
      items: [{ productId: "", quantity: 1 }],
    });
    await loadData();
  }

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Stock Transfers</h2>
          <p>Move inventory between warehouses</p>
        </div>
      </div>

      <form className="document-card" onSubmit={handleSubmit}>
        <div className="document-grid">
          <label>
            Date
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>
          <label>
            From Warehouse
            <select
              value={form.fromWarehouseId}
              onChange={(e) => setForm({ ...form, fromWarehouseId: e.target.value })}
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
            To Warehouse
            <select
              value={form.toWarehouseId}
              onChange={(e) => setForm({ ...form, toWarehouseId: e.target.value })}
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
        </div>

        {form.items.map((line, index) => (
          <div key={index} className="inline-form">
            <select
              value={line.productId}
              onChange={(e) => updateLine(index, "productId", e.target.value)}
              required
            >
              <option value="">Product</option>
              {lookups.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              value={line.quantity}
              onChange={(e) => updateLine(index, "quantity", e.target.value)}
            />
          </div>
        ))}

        <button
          type="button"
          className="secondary"
          onClick={() =>
            setForm((current) => ({
              ...current,
              items: [...current.items, { productId: "", quantity: 1 }],
            }))
          }
        >
          Add Line
        </button>

        {error && <p className="error-text">{error}</p>}

        <div className="document-actions">
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Transfer"}
          </button>
        </div>
      </form>

      {loading ? (
        <p>Loading transfers...</p>
      ) : (
        <DataTable columns={listColumns} data={rows} showActions={false} searchPlaceholder="Search transfers..." />
      )}
    </div>
  );
}
