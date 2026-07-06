import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DataTable from "../../components/DataTable";
import useDocIdHighlight from "../../hooks/useDocIdHighlight";

const columns = [
  { accessorKey: "number", header: "Invoice #" },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
  },
  {
    accessorKey: "vendor",
    header: "Vendor",
    cell: ({ row }) => row.original.vendor?.name ?? "-",
  },
  {
    accessorKey: "warehouse",
    header: "Warehouse",
    cell: ({ row }) => row.original.warehouse?.name ?? "-",
  },
  { accessorKey: "total", header: "Total" },
  {
    accessorKey: "paidAmount",
    header: "Paid",
    cell: ({ row }) => row.original.paidAmount ?? 0,
  },
  {
    accessorKey: "outstanding",
    header: "Outstanding",
    cell: ({ row }) => row.original.outstanding ?? 0,
  },
  {
    accessorKey: "isCredit",
    header: "Type",
    cell: ({ row }) => (row.original.isCredit ? "Credit" : "Cash"),
  },
];

export default function PurchaseInvoicesPage() {
  const highlightRowId = useDocIdHighlight();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const result = await window.api.purchase.listInvoices();
      if (!result.success) {
        setError(result.error);
      } else {
        setRows(result.data);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Purchase Invoices</h2>
          <p>Record supplier purchases and stock-in</p>
        </div>
        <Link to="/purchase/invoices/new" className="primary-link-button">
          New Purchase Invoice
        </Link>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          showActions={false}
          searchPlaceholder="Search invoices..."
          highlightRowId={highlightRowId}
        />
      )}
    </div>
  );
}
