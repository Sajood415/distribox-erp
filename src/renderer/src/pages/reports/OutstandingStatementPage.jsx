import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DataTable from "../../components/DataTable";
import PrintButton from "../../components/PrintButton";

const customerColumns = [
  { accessorKey: "code", header: "Code" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "salesman", header: "Salesman" },
  { accessorKey: "outstanding", header: "Outstanding" },
  { accessorKey: "available", header: "Available" },
];

const supplierColumns = [
  { accessorKey: "code", header: "Code" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "outstanding", header: "Outstanding" },
];

export default function OutstandingStatementPage() {
  const [partyType, setPartyType] = useState("customer");
  const [data, setData] = useState({ rows: [], totalOutstanding: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const result = await window.api.reports.outstandingStatement({ partyType });
      if (result.success) setData(result.data);
      setLoading(false);
    }
    load();
  }, [partyType]);

  const columns = partyType === "customer" ? customerColumns : supplierColumns;

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Outstanding Statement</h2>
          <p>All parties with non-zero balances</p>
        </div>
        <div className="header-actions-row">
          <Link to="/reports" className="secondary-link">
            All Reports
          </Link>
          <PrintButton
            title="Outstanding Statement"
            subtitle={partyType === "customer" ? "Customers" : "Suppliers"}
            columns={columns}
            rows={data.rows}
            summary={[{ label: "Total Outstanding", value: (data.totalOutstanding || 0).toFixed(2) }]}
          />
        </div>
      </div>

      <div className="filter-bar">
        <button type="button" className={partyType === "customer" ? "" : "secondary"} onClick={() => setPartyType("customer")}>
          Customers
        </button>
        <button type="button" className={partyType === "supplier" ? "" : "secondary"} onClick={() => setPartyType("supplier")}>
          Suppliers
        </button>
      </div>

      <section className="document-card">
        <div className="summary-cards">
          <article>
            <span>Total Outstanding</span>
            <strong>{(data.totalOutstanding || 0).toFixed(2)}</strong>
          </article>
        </div>
      </section>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable columns={columns} data={data.rows} showActions={false} searchPlaceholder="Search..." />
      )}
    </div>
  );
}
