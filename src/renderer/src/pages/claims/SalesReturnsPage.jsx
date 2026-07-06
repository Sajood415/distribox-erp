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
    accessorKey: "customer",
    header: "Customer",
    cell: ({ row }) => row.original.customer?.name ?? "-",
  },
  {
    accessorKey: "salesInvoice",
    header: "Invoice",
    cell: ({ row }) => row.original.salesInvoice?.number ?? "-",
  },
  { accessorKey: "total", header: "Total" },
  { accessorKey: "cogsTotal", header: "COGS" },
];

export default function SalesReturnsPage() {
  const highlightRowId = useDocIdHighlight();
  const [lookups, setLookups] = useState({
    customers: [],
    products: [],
    warehouses: [],
    units: [],
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [form, setForm] = useState({
    date: todayInputValue(),
    customerId: "",
    warehouseId: "",
    salesInvoiceId: "",
    remarks: "",
    items: [{ ...emptyPurchaseLine(), freeQuantity: 0 }],
  });

  const totals = calcPurchaseTotals(form.items.map((item) => ({ ...item, freeQuantity: 0 })));

  async function loadData() {
    const [lookupResult, listResult] = await Promise.all([
      window.api.sales.lookups(),
      window.api.sales.listReturns(),
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

  useEffect(() => {
    async function loadInvoices() {
      if (!form.customerId) {
        setCustomerInvoices([]);
        return;
      }
      const result = await window.api.sales.listInvoices();
      if (result.success) {
        setCustomerInvoices(
          result.data.filter((invoice) => String(invoice.customerId) === String(form.customerId))
        );
      }
    }
    loadInvoices();
  }, [form.customerId]);

  async function loadInvoiceLines(invoiceId) {
    if (!invoiceId) return;
    const result = await window.api.sales.getReturnInvoice(Number(invoiceId));
    if (!result.success) {
      setError(result.error);
      return;
    }
    const invoice = result.data;
    setForm((current) => ({
      ...current,
      warehouseId: String(invoice.warehouseId),
      items: invoice.items.map((item) => ({
        productId: String(item.productId),
        unitId: String(item.unitId),
        batchNo: item.batchNo || "",
        quantity: item.quantity,
        price: item.price,
        discount: item.discount,
        vatPercent: item.vatPercent,
        freeQuantity: 0,
      })),
    }));
  }

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

  function addLine() {
    setForm((current) => ({
      ...current,
      items: [...current.items, { ...emptyPurchaseLine(), freeQuantity: 0 }],
    }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const result = await window.api.sales.saveReturn({
      ...form,
      customerId: Number(form.customerId),
      warehouseId: Number(form.warehouseId),
      salesInvoiceId: form.salesInvoiceId ? Number(form.salesInvoiceId) : null,
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
      customerId: "",
      warehouseId: "",
      salesInvoiceId: "",
      remarks: "",
      items: [{ ...emptyPurchaseLine(), freeQuantity: 0 }],
    });
    await loadData();
  }

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Sales Returns</h2>
          <p>Return goods from customers, restore stock, and reverse revenue</p>
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
              Customer
              <select
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value, salesInvoiceId: "" })}
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
              Source Invoice
              <select
                value={form.salesInvoiceId}
                onChange={(e) => {
                  const invoiceId = e.target.value;
                  setForm({ ...form, salesInvoiceId: invoiceId });
                  loadInvoiceLines(invoiceId);
                }}
              >
                <option value="">Optional — load lines from invoice</option>
                {customerInvoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.number} ({invoice.total})
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
            <label className="span-2">
              Remarks
              <input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </label>
          </div>

          <div className="section-toolbar">
            <h3>Return Lines</h3>
            <button type="button" className="secondary" onClick={addLine}>
              Add Line
            </button>
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
              <span className="amount-cell">
                {calcPurchaseLine({ ...line, freeQuantity: 0 }).lineTotal.toFixed(2)}
              </span>
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
