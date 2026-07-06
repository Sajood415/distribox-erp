import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DataTable from "../../components/DataTable";

const lowStockColumns = [
  { accessorKey: "code", header: "Code" },
  { accessorKey: "name", header: "Product" },
  { accessorKey: "onHand", header: "On Hand" },
  { accessorKey: "reorderLevel", header: "Reorder Level" },
  { accessorKey: "shortfall", header: "Shortfall" },
];

const expiryColumns = [
  {
    accessorKey: "product",
    header: "Product",
    cell: ({ row }) => `${row.original.product?.code ?? ""} - ${row.original.product?.name ?? ""}`,
  },
  {
    accessorKey: "warehouse",
    header: "Warehouse",
    cell: ({ row }) => row.original.warehouse?.name ?? "-",
  },
  { accessorKey: "batchNo", header: "Batch" },
  { accessorKey: "quantity", header: "Qty" },
  {
    accessorKey: "expiryDate",
    header: "Expiry",
    cell: ({ row }) =>
      row.original.expiryDate ? new Date(row.original.expiryDate).toLocaleDateString() : "-",
  },
  { accessorKey: "status", header: "Status" },
];

export default function InventoryReportsPage() {
  const [lowStock, setLowStock] = useState([]);
  const [expiry, setExpiry] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [lowResult, expiryResult] = await Promise.all([
        window.api.inventory.lowStockReport(),
        window.api.inventory.expiryReport(),
      ]);
      if (lowResult.success) setLowStock(lowResult.data);
      if (expiryResult.success) setExpiry(expiryResult.data);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p>Loading inventory reports...</p>;

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Inventory Reports</h2>
          <p>Low stock and expiry alerts</p>
        </div>
      </div>

      <section className="document-card">
        <h3>Stock Ledger Reports</h3>
        <div className="module-grid">
          <Link to="/inventory/product-ledger" className="module-card">
            <strong>Product Ledger</strong>
            <span>Movement history by product</span>
          </Link>
          <Link to="/inventory/warehouse-ledger" className="module-card">
            <strong>Warehouse Ledger</strong>
            <span>Movements by warehouse</span>
          </Link>
          <Link to="/inventory/batch-ledger" className="module-card">
            <strong>Batch Ledger</strong>
            <span>Batch-level balances</span>
          </Link>
          <Link to="/inventory/stock-card" className="module-card">
            <strong>Stock Card</strong>
            <span>Product card per warehouse</span>
          </Link>
          <Link to="/inventory/movement-history" className="module-card">
            <strong>Movement History</strong>
            <span>Search all inventory movements</span>
          </Link>
        </div>
      </section>

      <section className="document-card">
        <h3>Low Stock ({lowStock.length})</h3>
        <DataTable columns={lowStockColumns} data={lowStock} showActions={false} searchPlaceholder="Search..." />
      </section>

      <section className="document-card">
        <h3>Expiry Alerts ({expiry.length})</h3>
        <DataTable columns={expiryColumns} data={expiry} showActions={false} searchPlaceholder="Search..." />
      </section>
    </div>
  );
}
