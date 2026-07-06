import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable";
import useDocIdHighlight from "../../hooks/useDocIdHighlight";
import { todayInputValue } from "../../utils/purchase";

const listColumns = [
  { accessorKey: "number", header: "Payment #" },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
  },
  {
    accessorKey: "vendor",
    header: "Supplier",
    cell: ({ row }) => row.original.vendor?.name ?? "-",
  },
  { accessorKey: "amount", header: "Amount" },
  { accessorKey: "paymentMode", header: "Mode" },
];

export default function VendorPaymentPage() {
  const highlightRowId = useDocIdHighlight();
  const [lookups, setLookups] = useState({ vendors: [] });
  const [rows, setRows] = useState([]);
  const [outstanding, setOutstanding] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    date: todayInputValue(),
    vendorId: "",
    paymentMode: "Cash",
    remarks: "",
    allocations: {},
  });

  async function loadData() {
    const [lookupResult, listResult] = await Promise.all([
      window.api.purchase.lookups(),
      window.api.purchase.listPayments(),
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
      if (!form.vendorId) {
        setOutstanding([]);
        return;
      }
      const result = await window.api.purchase.getOutstandingInvoices(Number(form.vendorId));
      if (result.success) {
        setOutstanding(result.data);
        setForm((current) => ({ ...current, allocations: {} }));
      }
    }
    loadOutstanding();
  }, [form.vendorId]);

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
      .map(([purchaseInvoiceId, amount]) => ({
        purchaseInvoiceId: Number(purchaseInvoiceId),
        amount: Number(amount),
      }));

    const result = await window.api.purchase.savePayment({
      ...form,
      vendorId: Number(form.vendorId),
      items,
    });

    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }

    setForm({
      date: todayInputValue(),
      vendorId: "",
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
          <h2>Supplier Payments</h2>
          <p>Pay suppliers and reduce accounts payable</p>
        </div>
      </div>

      <form className="document-card" onSubmit={handleSubmit}>
        <div className="document-grid">
          <label>
            Date
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>
          <label>
            Supplier
            <select
              value={form.vendorId}
              onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
              required
            >
              <option value="">Select supplier</option>
              {lookups.vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
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
        </div>

        {outstanding.length > 0 && (
          <div className="allocation-table-wrap">
            <h3>Outstanding Purchase Invoices</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Outstanding</th>
                  <th>Pay Amount</th>
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
            <p className="hint-text">Total payment: {totalAllocated.toFixed(2)}</p>
          </div>
        )}

        {error ? <p className="error-text">{error}</p> : null}

        <div className="document-actions">
          <button type="submit" disabled={saving || totalAllocated <= 0}>
            {saving ? "Saving..." : "Save Payment"}
          </button>
        </div>
      </form>

      {loading ? (
        <p>Loading payments...</p>
      ) : (
        <DataTable
          columns={listColumns}
          data={rows}
          showActions={false}
          searchPlaceholder="Search payments..."
          highlightRowId={highlightRowId}
        />
      )}
    </div>
  );
}
