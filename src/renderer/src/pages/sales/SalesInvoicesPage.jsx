import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DataTable from "../../components/DataTable";

const columns = [
  { accessorKey: "number", header: "Invoice #" },
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
  { accessorKey: "total", header: "Total" },
  {
    accessorKey: "outstanding",
    header: "Outstanding",
    cell: ({ row }) => row.original.outstanding ?? 0,
  },
  {
    accessorKey: "status",
    header: "Status",
  },
  {
    accessorKey: "isCredit",
    header: "Type",
    cell: ({ row }) => (row.original.isCredit ? "Credit" : "Cash"),
  },
];

export default function SalesInvoicesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const result = await window.api.sales.listInvoices();
      if (!result.success) setError(result.error);
      else setRows(result.data);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Sales Invoices</h2>
          <p>Customer sales, stock-out, receivables, and COGS posting</p>
        </div>
        <Link to="/sales/invoices/new" className="primary-link-button">
          New Sales Invoice
        </Link>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable columns={columns} data={rows} showActions={false} searchPlaceholder="Search sales..." />
      )}
    </div>
  );
}
