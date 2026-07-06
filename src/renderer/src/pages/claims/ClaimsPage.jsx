import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable";
import DocumentLifecyclePanel from "../../components/DocumentLifecyclePanel";
import { lifecycleStatusColumn } from "../../utils/document-lifecycle-columns";
import {
  calcPurchaseLine,
  calcPurchaseTotals,
  emptyPurchaseLine,
  todayInputValue,
} from "../../utils/purchase";

const STATUS_OPTIONS = ["", "Open", "Approved", "Rejected", "Settled"];
const PARTY_OPTIONS = ["", "Customer", "Supplier"];
const CLAIM_TYPES = ["Damage", "Expiry", "Shortage", "Other"];

const CUSTOMER_RESOLUTIONS = ["Credit", "Replace", "WriteOff"];
const SUPPLIER_RESOLUTIONS = ["SupplierReturn"];

export default function ClaimsPage() {
  const [lookups, setLookups] = useState({
    customers: [],
    vendors: [],
    products: [],
    warehouses: [],
    salesmen: [],
  });
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterParty, setFilterParty] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [settleTarget, setSettleTarget] = useState(null);
  const [settleResolution, setSettleResolution] = useState("Credit");
  const [form, setForm] = useState({
    partyType: "Customer",
    date: todayInputValue(),
    deliveryDate: todayInputValue(),
    customerId: "",
    vendorId: "",
    warehouseId: "",
    salesmanId: "",
    claimType: "Damage",
    remarks: "",
    items: [{ ...emptyPurchaseLine(), freeQuantity: 0, reason: "" }],
  });

  const totals = calcPurchaseTotals(form.items.map((item) => ({ ...item, freeQuantity: 0 })));

  const columns = [
      { accessorKey: "number", header: "Claim #" },
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
      },
      { accessorKey: "partyType", header: "Party" },
      {
        accessorKey: "party",
        header: "Name",
        cell: ({ row }) => row.original.customer?.name || row.original.vendor?.name || "-",
      },
      { accessorKey: "claimType", header: "Type" },
      { accessorKey: "status", header: "Status" },
      { accessorKey: "total", header: "Amount" },
      lifecycleStatusColumn,
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const claim = row.original;
          return (
            <div className="table-extra-actions">
              {claim.status === "Open" && (
                <button type="button" className="secondary" onClick={() => handleStatus(claim.id, "Approved")}>
                  Approve
                </button>
              )}
              {["Open", "Approved"].includes(claim.status) && (
                <button type="button" className="danger" onClick={() => handleStatus(claim.id, "Rejected")}>
                  Reject
                </button>
              )}
              {claim.status === "Approved" && (
                <button type="button" onClick={() => openSettle(claim)}>
                  Settle
                </button>
              )}
            </div>
          );
        },
      },
    ];

  async function loadData() {
    setLoading(true);
    const filters = {};
    if (filterStatus) filters.status = filterStatus;
    if (filterParty) filters.partyType = filterParty;

    const [lookupResult, listResult, reportResult] = await Promise.all([
      window.api.claims.lookups(),
      window.api.claims.list(filters),
      window.api.claims.report({}),
    ]);

    if (lookupResult.success) setLookups(lookupResult.data);
    if (listResult.success) setRows(listResult.data);
    if (reportResult.success) setSummary(reportResult.data.summary);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [filterStatus, filterParty]);

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
      items: [...current.items, { ...emptyPurchaseLine(), freeQuantity: 0, reason: "" }],
    }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const result = await window.api.claims.save({
      ...form,
      customerId: form.partyType === "Customer" ? Number(form.customerId) : null,
      vendorId: form.partyType === "Supplier" ? Number(form.vendorId) : null,
      warehouseId: Number(form.warehouseId),
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
    setForm({
      partyType: "Customer",
      date: todayInputValue(),
      deliveryDate: todayInputValue(),
      customerId: "",
      vendorId: "",
      warehouseId: "",
      salesmanId: "",
      claimType: "Damage",
      remarks: "",
      items: [{ ...emptyPurchaseLine(), freeQuantity: 0, reason: "" }],
    });
    await loadData();
  }

  async function handleStatus(id, status) {
    const result = await window.api.claims.updateStatus({ id, status });
    if (!result.success) {
      setError(result.error);
      return;
    }
    await loadData();
  }

  function openSettle(claim) {
    setSettleTarget(claim);
    setSettleResolution(claim.partyType === "Supplier" ? "SupplierReturn" : "Credit");
  }

  async function handleSettle() {
    if (!settleTarget) return;
    setSaving(true);
    const result = await window.api.claims.settle({
      id: settleTarget.id,
      resolution: settleResolution,
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSettleTarget(null);
    await loadData();
  }

  const resolutionOptions =
    settleTarget?.partyType === "Supplier" ? SUPPLIER_RESOLUTIONS : CUSTOMER_RESOLUTIONS;

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Claims</h2>
          <p>Customer and supplier claims for damaged, expired, or disputed goods</p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Hide Form" : "New Claim"}
        </button>
      </div>

      {summary && (
        <section className="document-card">
          <div className="summary-cards">
            <article>
              <span>Total Claims</span>
              <strong>{summary.total}</strong>
            </article>
            <article>
              <span>Open</span>
              <strong>{summary.open}</strong>
            </article>
            <article>
              <span>Settled</span>
              <strong>{summary.settled}</strong>
            </article>
            <article>
              <span>Claim Value</span>
              <strong>{summary.claimValue.toFixed(2)}</strong>
            </article>
          </div>
        </section>
      )}

      <div className="filter-bar">
        <select value={filterParty} onChange={(e) => setFilterParty(e.target.value)}>
          {PARTY_OPTIONS.map((option) => (
            <option key={option || "all"} value={option}>
              {option || "All Parties"}
            </option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option || "all"} value={option}>
              {option || "All Statuses"}
            </option>
          ))}
        </select>
      </div>

      {showForm && (
        <form className="document-card" onSubmit={handleSave}>
          <div className="document-grid">
            <label>
              Party Type
              <select
                value={form.partyType}
                onChange={(e) => setForm({ ...form, partyType: e.target.value })}
              >
                <option value="Customer">Customer Claim</option>
                <option value="Supplier">Supplier Claim</option>
              </select>
            </label>
            <label>
              Claim Date
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </label>
            <label>
              Delivery Date
              <input
                type="date"
                value={form.deliveryDate}
                onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })}
              />
            </label>
            <label>
              Claim Type
              <select
                value={form.claimType}
                onChange={(e) => setForm({ ...form, claimType: e.target.value })}
              >
                {CLAIM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            {form.partyType === "Customer" ? (
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
            ) : (
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
            )}
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
            {form.partyType === "Customer" && (
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
            )}
            <label className="span-2">
              Remarks
              <input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </label>
          </div>

          <div className="section-toolbar">
            <h3>Claim Lines</h3>
            <button type="button" className="secondary" onClick={addLine}>
              Add Line
            </button>
          </div>

          {form.items.map((line, index) => (
            <div key={index} className="claim-line">
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
                placeholder="Qty"
                value={line.quantity}
                onChange={(e) => updateLine(index, "quantity", e.target.value)}
              />
              <input
                type="number"
                min="0"
                placeholder="Price"
                value={line.price}
                onChange={(e) => updateLine(index, "price", e.target.value)}
              />
              <input
                placeholder="Reason"
                value={line.reason || ""}
                onChange={(e) => updateLine(index, "reason", e.target.value)}
              />
              <span className="amount-cell">
                {calcPurchaseLine({ ...line, freeQuantity: 0 }).lineTotal.toFixed(2)}
              </span>
            </div>
          ))}

          <div className="totals-grid compact">
            <span>Claim Total</span>
            <strong>{totals.total.toFixed(2)}</strong>
          </div>

          <div className="document-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Claim"}
            </button>
          </div>
        </form>
      )}

      {settleTarget && (
        <section className="document-card">
          <h3>Settle Claim {settleTarget.number}</h3>
          <div className="document-grid">
            <label>
              Resolution
              <select value={settleResolution} onChange={(e) => setSettleResolution(e.target.value)}>
                {resolutionOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="hint-text">
            Credit creates a sales return. Replace restocks without credit. WriteOff posts to expense. SupplierReturn
            creates a purchase return.
          </p>
          <div className="document-actions">
            <button type="button" className="secondary" onClick={() => setSettleTarget(null)}>
              Cancel
            </button>
            <button type="button" onClick={handleSettle} disabled={saving}>
              {saving ? "Settling..." : "Confirm Settlement"}
            </button>
          </div>
        </section>
      )}

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>Loading claims...</p>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          showActions={false}
          searchPlaceholder="Search claims..."
          onRowClick={setSelected}
        />
      )}
      {selected && (
        <DocumentLifecyclePanel
          documentType={selected.partyType === "Supplier" ? "SUPPLIER_CLAIM" : "CUSTOMER_CLAIM"}
          documentId={selected.id}
          documentNumber={selected.number}
          onRefresh={loadData}
        />
      )}
    </div>
  );
}
