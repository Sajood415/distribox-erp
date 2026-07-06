import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  calcPurchaseLine,
  calcPurchaseTotals,
  emptyPurchaseLine,
  todayInputValue,
} from "../../utils/purchase";

export default function SalesInvoiceFormPage() {
  const navigate = useNavigate();
  const [lookups, setLookups] = useState({
    customers: [],
    products: [],
    warehouses: [],
    units: [],
    salesmen: [],
    deliveryMen: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [creditWarning, setCreditWarning] = useState("");
  const [creditLimitPolicy, setCreditLimitPolicy] = useState("BLOCK");

  const [form, setForm] = useState({
    date: todayInputValue(),
    customerId: "",
    warehouseId: "",
    salesmanId: "",
    deliveryManId: "",
    isCredit: true,
    freight: 0,
    paidAmount: 0,
    remarks: "",
    items: [emptyPurchaseLine()],
  });

  const totals = useMemo(
    () => calcPurchaseTotals(form.items, form.freight, form.paidAmount),
    [form.items, form.freight, form.paidAmount]
  );

  useEffect(() => {
    async function load() {
      const [result, settingsResult] = await Promise.all([
        window.api.sales.lookups(),
        window.api.settings.get(),
      ]);
      if (result.success) {
        setLookups(result.data);
        if (result.data.warehouses.length > 0) {
          setForm((current) => ({
            ...current,
            warehouseId: String(result.data.warehouses[0].id),
          }));
        }
      }
      if (settingsResult.success) {
        setCreditLimitPolicy(settingsResult.data.settings.credit_limit_policy || "BLOCK");
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    async function checkCredit() {
      if (!form.customerId || !form.isCredit) {
        setCreditWarning("");
        return;
      }
      const customer = lookups.customers.find((c) => String(c.id) === String(form.customerId));
      if (!customer || customer.creditLimit <= 0) {
        setCreditWarning("");
        return;
      }
      const outstandingResult = await window.api.sales.getCustomerOutstanding(Number(form.customerId));
      if (outstandingResult.success) {
        const projected = outstandingResult.data.outstanding + totals.total;
        if (projected > customer.creditLimit) {
          const prefix =
            creditLimitPolicy === "WARN"
              ? "Warning"
              : "Blocked";
          setCreditWarning(
            `${prefix}: projected balance ${projected.toFixed(2)} exceeds credit limit ${customer.creditLimit.toFixed(2)}`
          );
        } else {
          setCreditWarning("");
        }
      }
    }
    checkCredit();
  }, [form.customerId, form.isCredit, totals.total, lookups.customers, creditLimitPolicy]);

  function updateField(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "customerId") {
        const customer = lookups.customers.find((c) => String(c.id) === String(value));
        if (customer?.salesmanId) {
          next.salesmanId = String(customer.salesmanId);
        }
      }
      return next;
    });
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
    setForm((current) => ({ ...current, items: [...current.items, emptyPurchaseLine()] }));
  }

  function removeLine(index) {
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, i) => i !== index),
    }));
  }

  async function submitInvoice(confirmCreditOverride = false) {
    setSaving(true);
    setError("");

    const result = await window.api.sales.saveInvoice({
      ...form,
      customerId: Number(form.customerId),
      warehouseId: Number(form.warehouseId),
      salesmanId: form.salesmanId ? Number(form.salesmanId) : null,
      deliveryManId: form.deliveryManId ? Number(form.deliveryManId) : null,
      confirmCreditOverride,
      items: form.items.map((item) => ({
        ...item,
        productId: Number(item.productId),
        unitId: Number(item.unitId),
      })),
    });

    setSaving(false);
    if (!result.success) {
      if (result.requiresConfirmation && creditLimitPolicy === "WARN") {
        const proceed = window.confirm(
          `${result.error}\n\nSave this invoice anyway?`
        );
        if (proceed) {
          await submitInvoice(true);
        }
        return;
      }
      setError(result.error);
      return;
    }
    navigate("/sales/invoices");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await submitInvoice(false);
  }

  if (loading) return <p>Loading sales form...</p>;

  return (
    <form className="document-page" onSubmit={handleSubmit}>
      <div className="page-header">
        <div>
          <h2>New Sales Invoice</h2>
          <p>FIFO stock issue, AR/cash posting, and COGS calculation</p>
        </div>
        <Link to="/sales/invoices" className="secondary-link">
          Back to list
        </Link>
      </div>

      <section className="document-card">
        <div className="document-grid">
          <label>
            Date
            <input type="date" value={form.date} onChange={(e) => updateField("date", e.target.value)} required />
          </label>
          <label>
            Customer
            <select value={form.customerId} onChange={(e) => updateField("customerId", e.target.value)} required>
              <option value="">Select customer</option>
              {lookups.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} ({customer.code})
                </option>
              ))}
            </select>
          </label>
          <label>
            Warehouse
            <select value={form.warehouseId} onChange={(e) => updateField("warehouseId", e.target.value)} required>
              <option value="">Select warehouse</option>
              {lookups.warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Salesman
            <select value={form.salesmanId} onChange={(e) => updateField("salesmanId", e.target.value)}>
              <option value="">Optional</option>
              {lookups.salesmen.map((salesman) => (
                <option key={salesman.id} value={salesman.id}>
                  {salesman.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Delivery Man
            <select value={form.deliveryManId} onChange={(e) => updateField("deliveryManId", e.target.value)}>
              <option value="">Optional</option>
              {lookups.deliveryMen.map((man) => (
                <option key={man.id} value={man.id}>
                  {man.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Payment Type
            <select
              value={form.isCredit ? "credit" : "cash"}
              onChange={(e) => updateField("isCredit", e.target.value === "credit")}
            >
              <option value="credit">Credit</option>
              <option value="cash">Cash</option>
            </select>
          </label>
          <label>
            Freight
            <input type="number" min="0" step="0.01" value={form.freight} onChange={(e) => updateField("freight", e.target.value)} />
          </label>
          <label>
            Received Amount
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.paidAmount}
              onChange={(e) => updateField("paidAmount", e.target.value)}
            />
          </label>
        </div>
        {creditWarning && <p className="warning-text">{creditWarning}</p>}
      </section>

      <section className="document-card">
        <div className="section-toolbar">
          <h3>Line Items</h3>
          <button type="button" className="secondary" onClick={addLine}>
            Add Line
          </button>
        </div>
        <div className="line-items-scroll">
          <table className="line-items-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Unit</th>
                <th>Qty</th>
                <th>Free</th>
                <th>Price</th>
                <th>Disc %</th>
                <th>VAT %</th>
                <th>Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {form.items.map((line, index) => (
                <tr key={index}>
                  <td>
                    <select
                      value={line.productId}
                      onChange={(e) => updateLine(index, "productId", e.target.value)}
                      required
                    >
                      <option value="">Select</option>
                      {lookups.products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.code} - {product.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select value={line.unitId} onChange={(e) => updateLine(index, "unitId", e.target.value)}>
                      {lookups.units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input type="number" min="0" value={line.quantity} onChange={(e) => updateLine(index, "quantity", e.target.value)} />
                  </td>
                  <td>
                    <input type="number" min="0" value={line.freeQuantity} onChange={(e) => updateLine(index, "freeQuantity", e.target.value)} />
                  </td>
                  <td>
                    <input type="number" min="0" value={line.price} onChange={(e) => updateLine(index, "price", e.target.value)} />
                  </td>
                  <td>
                    <input type="number" min="0" value={line.discount} onChange={(e) => updateLine(index, "discount", e.target.value)} />
                  </td>
                  <td>
                    <input type="number" min="0" value={line.vatPercent} onChange={(e) => updateLine(index, "vatPercent", e.target.value)} />
                  </td>
                  <td className="amount-cell">{calcPurchaseLine(line).lineTotal.toFixed(2)}</td>
                  <td>
                    <button type="button" className="danger" onClick={() => removeLine(index)} disabled={form.items.length === 1}>
                      X
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="document-card totals-card">
        <div className="totals-grid">
          <span>Subtotal</span>
          <strong>{totals.subtotal.toFixed(2)}</strong>
          <span>Tax</span>
          <strong>{totals.taxTotal.toFixed(2)}</strong>
          <span>Grand Total</span>
          <strong>{totals.total.toFixed(2)}</strong>
          <span>Outstanding</span>
          <strong>{totals.outstanding.toFixed(2)}</strong>
        </div>
      </section>

      {error && <p className="error-text">{error}</p>}

      <div className="document-actions">
        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Sales Invoice"}
        </button>
      </div>
    </form>
  );
}
