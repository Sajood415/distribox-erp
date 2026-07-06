import { useEffect, useMemo, useState } from "react";
import DataTable from "../../components/DataTable";
import {
  calcPurchaseLine,
  calcPurchaseTotals,
  emptyPurchaseLine,
  todayInputValue,
} from "../../utils/purchase";

const listColumns = [
  { accessorKey: "number", header: "Quote #" },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
  },
  {
    accessorKey: "customer",
    header: "Customer",
    cell: ({ row }) => row.original.customer?.name ?? "-",
  },
  { accessorKey: "total", header: "Total" },
  { accessorKey: "status", header: "Status" },
];

export default function QuotationsPage() {
  const [lookups, setLookups] = useState({ customers: [], products: [], units: [], salesmen: [] });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    date: todayInputValue(),
    validUntil: todayInputValue(),
    customerId: "",
    salesmanId: "",
    remarks: "",
    items: [emptyPurchaseLine()],
  });

  const totals = useMemo(() => calcPurchaseTotals(form.items), [form.items]);

  async function loadData() {
    const [lookupResult, listResult] = await Promise.all([
      window.api.sales.lookups(),
      window.api.sales.listQuotations(),
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
      const line = { ...items[index], [key]: value };
      if (key === "productId") {
        const product = lookups.products.find((p) => String(p.id) === String(value));
        if (product) {
          line.unitId = String(product.baseUnitId);
          line.price = product.price1 || 0;
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
    const result = await window.api.sales.saveQuotation({
      ...form,
      customerId: Number(form.customerId),
      salesmanId: form.salesmanId ? Number(form.salesmanId) : null,
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
    await loadData();
  }

  async function handleConvert(id) {
    setError("");
    const result = await window.api.sales.convertQuotation(id);
    if (!result.success) {
      setError(result.error);
      return;
    }
    await loadData();
  }

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Quotations</h2>
          <p>Draft quotes — no stock or accounting impact until converted</p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Hide Form" : "New Quotation"}
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
              Valid Until
              <input
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              />
            </label>
            <label>
              Customer
              <select
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                required
              >
                <option value="">Select customer</option>
                {lookups.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Salesman
              <select
                value={form.salesmanId}
                onChange={(e) => setForm({ ...form, salesmanId: e.target.value })}
              >
                <option value="">Optional</option>
                {lookups.salesmen.map((salesman) => (
                  <option key={salesman.id} value={salesman.id}>
                    {salesman.name}
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
              <span className="amount-cell">{calcPurchaseLine(line).lineTotal.toFixed(2)}</span>
            </div>
          ))}

          <div className="totals-grid compact">
            <span>Total</span>
            <strong>{totals.total.toFixed(2)}</strong>
          </div>

          <div className="document-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Quotation"}
            </button>
          </div>
        </form>
      )}

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="data-table-wrap">
          <DataTable columns={listColumns} data={rows} showActions={false} searchPlaceholder="Search quotes..." />
          <div className="table-extra-actions">
            {rows
              .filter((row) => row.status === "Open")
              .map((row) => (
                <button key={row.id} type="button" className="secondary" onClick={() => handleConvert(row.id)}>
                  Convert {row.number} to Invoice
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
