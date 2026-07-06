import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable";
import { todayInputValue } from "../../utils/purchase";

const slipColumns = [
  { accessorKey: "number", header: "Load Slip #" },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
  },
  {
    accessorKey: "deliveryMan",
    header: "Delivery Man",
    cell: ({ row }) => row.original.deliveryMan?.name ?? "-",
  },
  {
    accessorKey: "invoices",
    header: "Invoices",
    cell: ({ row }) => row.original.invoices?.length ?? 0,
  },
  { accessorKey: "status", header: "Status" },
];

export default function LoadSlipsPage() {
  const [lookups, setLookups] = useState({ deliveryMen: [] });
  const [pending, setPending] = useState([]);
  const [slips, setSlips] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    date: todayInputValue(),
    deliveryManId: "",
    remarks: "",
  });

  async function loadData() {
    const [lookupResult, pendingResult, slipResult] = await Promise.all([
      window.api.sales.lookups(),
      window.api.sales.listPendingDeliveries(),
      window.api.sales.listLoadSlips(),
    ]);
    if (lookupResult.success) setLookups(lookupResult.data);
    if (pendingResult.success) setPending(pendingResult.data);
    if (slipResult.success) setSlips(slipResult.data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function toggleInvoice(id) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const result = await window.api.sales.saveLoadSlip({
      ...form,
      deliveryManId: Number(form.deliveryManId),
      invoiceIds: selectedIds,
    });

    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }

    setSelectedIds([]);
    await loadData();
  }

  async function handleDeliver(id) {
    const result = await window.api.sales.deliverLoadSlip(id);
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
          <h2>Load Slips</h2>
          <p>Group sales invoices for delivery routes</p>
        </div>
      </div>

      <form className="document-card" onSubmit={handleCreate}>
        <div className="document-grid">
          <label>
            Date
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>
          <label>
            Delivery Man
            <select
              value={form.deliveryManId}
              onChange={(e) => setForm({ ...form, deliveryManId: e.target.value })}
              required
            >
              <option value="">Select delivery man</option>
              {lookups.deliveryMen.map((man) => (
                <option key={man.id} value={man.id}>
                  {man.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="pending-invoices">
          <h3>Pending Invoices</h3>
          {pending.length === 0 ? (
            <p className="hint-text">No unassigned invoices</p>
          ) : (
            pending.map((invoice) => (
              <label key={invoice.id} className="checkbox-field invoice-pick">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(invoice.id)}
                  onChange={() => toggleInvoice(invoice.id)}
                />
                <span>
                  {invoice.number} · {invoice.customer?.name} · {invoice.total.toFixed(2)}
                </span>
              </label>
            ))
          )}
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="document-actions">
          <button type="submit" disabled={saving || selectedIds.length === 0}>
            {saving ? "Creating..." : "Create Load Slip"}
          </button>
        </div>
      </form>

      {loading ? (
        <p>Loading load slips...</p>
      ) : (
        <>
          <DataTable columns={slipColumns} data={slips} showActions={false} searchPlaceholder="Search load slips..." />
          <div className="table-extra-actions">
            {slips
              .filter((slip) => slip.status === "Pending")
              .map((slip) => (
                <button key={slip.id} type="button" className="secondary" onClick={() => handleDeliver(slip.id)}>
                  Mark {slip.number} Delivered
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
