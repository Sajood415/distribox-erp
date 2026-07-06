import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable";

export default function TradeOffersPage() {
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({ customers: [], products: [] });
  const [form, setForm] = useState({
    code: "",
    name: "",
    offerType: "BUY_X_GET_Y",
    priority: 100,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    buyQuantity: 10,
    getQuantity: 1,
    discountPercent: 0,
    discountAmount: 0,
  });

  async function load() {
    const [offers, masterLookups] = await Promise.all([
      window.api.offers.list(),
      window.api.masters.lookups(),
    ]);
    if (offers.success) setRows(offers.data);
    if (masterLookups.success) {
      setLookups({
        customers: masterLookups.data.customers || [],
        products: masterLookups.data.products || [],
      });
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    const result = await window.api.offers.save(form);
    if (!result.success) alert(result.error);
    else load();
  }

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Trade Offers / Schemes</h2>
          <p>Buy X Get Y, slabs, discounts — auto-applied on invoice preview</p>
        </div>
      </div>

      <section className="document-card">
        <div className="document-grid">
          <label>Code<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>
            Type
            <select value={form.offerType} onChange={(e) => setForm({ ...form, offerType: e.target.value })}>
              <option value="BUY_X_GET_Y">Buy X Get Y</option>
              <option value="SLAB_DISCOUNT">Quantity Slabs</option>
              <option value="PERCENT_DISCOUNT">Percent Discount</option>
              <option value="FIXED_DISCOUNT">Fixed Discount</option>
              <option value="FREE_PRODUCT">Free Product</option>
            </select>
          </label>
          <label>Priority<input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /></label>
          <label>Buy Qty<input type="number" value={form.buyQuantity} onChange={(e) => setForm({ ...form, buyQuantity: e.target.value })} /></label>
          <label>Free Qty<input type="number" value={form.getQuantity} onChange={(e) => setForm({ ...form, getQuantity: e.target.value })} /></label>
        </div>
        <button type="button" onClick={handleSave}>Save Offer</button>
      </section>

      <DataTable
        columns={[
          { accessorKey: "code", header: "Code" },
          { accessorKey: "name", header: "Name" },
          { accessorKey: "offerType", header: "Type" },
          { accessorKey: "priority", header: "Priority" },
          { accessorKey: "active", header: "Active", cell: ({ row }) => (row.original.active ? "Yes" : "No") },
        ]}
        data={rows}
        showActions={false}
        searchPlaceholder="Search offers..."
      />
    </div>
  );
}
