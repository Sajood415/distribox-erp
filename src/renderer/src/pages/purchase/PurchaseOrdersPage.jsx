import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable";
import DocumentLifecyclePanel from "../../components/DocumentLifecyclePanel";
import { lifecycleStatusColumn } from "../../utils/document-lifecycle-columns";

const columns = [
  { accessorKey: "number", header: "PO #" },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
  },
  { accessorKey: "vendor", header: "Vendor", cell: ({ row }) => row.original.vendor?.name ?? "-" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "total", header: "Total" },
  lifecycleStatusColumn,
];

export default function PurchaseOrdersPage() {
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({ vendors: [], products: [], warehouses: [], units: [] });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    vendorId: "",
    warehouseId: "",
    date: new Date().toISOString().slice(0, 10),
    remarks: "",
    items: [{ productId: "", unitId: "", quantity: 1, price: 0, discount: 0, vatPercent: 0 }],
  });

  async function load() {
    const [listResult, lookupResult] = await Promise.all([
      window.api.purchase.listOrders(),
      window.api.purchase.lookups(),
    ]);
    if (listResult.success) setRows(listResult.data);
    if (lookupResult.success) setLookups(lookupResult.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    const result = await window.api.purchase.saveOrder(form);
    if (result.success) {
      setForm({
        vendorId: "",
        warehouseId: "",
        date: new Date().toISOString().slice(0, 10),
        remarks: "",
        items: [{ productId: "", unitId: "", quantity: 1, price: 0, discount: 0, vatPercent: 0 }],
      });
      load();
    } else {
      alert(result.error);
    }
  }

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Purchase Orders</h2>
          <p>Draft → Approve → Receive → Convert to purchase invoice</p>
        </div>
      </div>

      <section className="document-card">
        <h3>New Purchase Order</h3>
        <div className="document-grid">
          <label>
            Vendor
            <select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>
              <option value="">Select vendor</option>
              {lookups.vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </label>
          <label>
            Warehouse
            <select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
              <option value="">Select warehouse</option>
              {lookups.warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>
        </div>
        <button type="button" onClick={handleSave}>Save Draft PO</button>
      </section>

      {loading ? <p>Loading...</p> : (
        <DataTable
          columns={[
            ...columns,
            {
              id: "actions",
              header: "Actions",
              cell: ({ row }) => (
                <div className="table-actions">
                  {row.original.status === "Draft" && (
                    <button type="button" onClick={async () => { await window.api.purchase.approveOrder(row.original.id); load(); }}>Approve</button>
                  )}
                  {["Approved", "Partial"].includes(row.original.status) && (
                    <button type="button" onClick={async () => {
                      const result = await window.api.purchase.convertOrder({ id: row.original.id });
                      if (!result.success) alert(result.error); else load();
                    }}>Convert to Invoice</button>
                  )}
                  {row.original.status === "Draft" && (
                    <button type="button" className="danger" onClick={async () => { await window.api.purchase.deleteOrder(row.original.id); load(); }}>Delete</button>
                  )}
                </div>
              ),
            },
          ]}
          data={rows}
          showActions={false}
          searchPlaceholder="Search PO..."
          onRowClick={setSelected}
        />
      )}
      {selected && (
        <DocumentLifecyclePanel
          documentType="PURCHASE_ORDER"
          documentId={selected.id}
          documentNumber={selected.number}
          onRefresh={load}
        />
      )}
    </div>
  );
}
