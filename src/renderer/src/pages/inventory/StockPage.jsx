import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable";

const columns = [
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
  { accessorKey: "costPerUnit", header: "Cost" },
  {
    accessorKey: "value",
    header: "Value",
    cell: ({ row }) => (row.original.quantity * row.original.costPerUnit).toFixed(2),
  },
];

export default function StockPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const result = await window.api.stock.list();
      if (!result.success) {
        setError(result.error);
      } else {
        setRows(result.data);
      }
      setLoading(false);
    }
    load();
  }, []);

  const totalValue = rows.reduce((sum, row) => sum + row.quantity * row.costPerUnit, 0);

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Current Stock</h2>
          <p>
            {rows.length} stock records · Total value {totalValue.toFixed(2)}
          </p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>Loading stock...</p>
      ) : (
        <DataTable columns={columns} data={rows} showActions={false} searchPlaceholder="Search stock..." />
      )}
    </div>
  );
}
