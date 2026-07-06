import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable";
import { todayInputValue } from "../../utils/purchase";

const listColumns = [
  { accessorKey: "number", header: "Recovery #" },
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
  { accessorKey: "amount", header: "Amount" },
  { accessorKey: "paymentMode", header: "Mode" },
];

export default function RecoveryPage() {
  const [lookups, setLookups] = useState({ customers: [], salesmen: [], deliveryMen: [] });
  const [rows, setRows] = useState([]);
  const [outstanding, setOutstanding] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    date: todayInputValue(),
    customerId: "",
    salesmanId: "",
    deliveryManId: "",
    paymentMode: "Cash",
    remarks: "",
    allocations: {},
  });

  async function loadData() {
    const [lookupResult, listResult] = await Promise.all([
      window.api.sales.lookups(),
      window.api.sales.listRecoveries(),
    ]);
    if (lookupResult.success) setLookups(lookupResult.data);
    if (listResult.success) setRows(listResult.data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    async function loadOutstanding() {
      if (!form.customerId) {
        setOutstanding([]);
        return;
      }
      const result = await window.api.sales.getOutstandingInvoices(Number(form.customerId));
      if (result.success) {
        setOutstanding(result.data);
        setForm((current) => ({ ...current, allocations: {} }));
      }
    }
    loadOutstanding();
  }, [form.customerId]);

  const totalAllocated = Object.values(form.allocations).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0
  );

  function setAllocation(invoiceId, amount) {
    setForm((current) => ({
      ...current,
      allocations: { ...current.allocations, [invoiceId]: amount },
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const items = Object.entries(form.allocations)
      .filter(([, amount]) => Number(amount) > 0)
      .map(([salesInvoiceId, amount]) => ({
        salesInvoiceId: Number(salesInvoiceId),
        amount: Number(amount),
      }));

    const result = await window.api.sales.saveRecovery({
      ...form,
      customerId: Number(form.customerId),
      salesmanId: form.salesmanId ? Number(form.salesmanId) : null,
      deliveryManId: form.deliveryManId ? Number(form.deliveryManId) : null,
      amount: totalAllocated,
      items,
    });

    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }

    setForm({
      date: todayInputValue(),
      customerId: "",
      salesmanId: "",
      deliveryManId: "",
      paymentMode: "Cash",
      remarks: "",
      allocations: {},
    });
    await loadData();
  }

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Daily Recovery</h2>
          <p>Collect customer payments and reduce receivables</p>
        </div>
      </div>

      <form className="document-card" onSubmit={handleSubmit}>
        <div className="document-grid">
          <label>
            Date
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
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
            Payment Mode
            <select
              value={form.paymentMode}
              onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}
            >
              <option value="Cash">Cash</option>
              <option value="Bank">Bank</option>
            </select>
          </label>
          <label>
            Collector
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

        {outstanding.length > 0 && (
          <div className="allocation-table-wrap">
            <h3>Outstanding Invoices</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Outstanding</th>
                  <th>Apply Amount</th>
                </tr>
              </thead>
              <tbody>
                {outstanding.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.number}</td>
                    <td>{new Date(invoice.date).toLocaleDateString()}</td>
                    <td>{invoice.outstanding.toFixed(2)}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max={invoice.outstanding}
                        step="0.01"
                        value={form.allocations[invoice.id] ?? ""}
                        onChange={(e) => setAllocation(invoice.id, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hint-text">Total recovery: {totalAllocated.toFixed(2)}</p>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}

        <div className="document-actions">
          <button type="submit" disabled={saving || totalAllocated <= 0}>
            {saving ? "Saving..." : "Save Recovery"}
          </button>
        </div>
      </form>

      {loading ? (
        <p>Loading recoveries...</p>
      ) : (
        <DataTable columns={listColumns} data={rows} showActions={false} searchPlaceholder="Search recoveries..." />
      )}
    </div>
  );
}
