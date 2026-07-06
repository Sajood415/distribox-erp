import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DataTable from "../../components/DataTable";
import ReportDateRange, { defaultEndDate, defaultStartDate } from "../../components/ReportDateRange";

const columns = [
  { accessorKey: "name", header: "Salesman" },
  { accessorKey: "commissionRate", header: "Rate %" },
  { accessorKey: "salesTotal", header: "Sales" },
  { accessorKey: "recoveryTotal", header: "Recovery" },
  { accessorKey: "salesCommission", header: "Sales Comm." },
  { accessorKey: "recoveryCommission", header: "Recovery Comm." },
  { accessorKey: "totalCommission", header: "Total Comm." },
];

export default function SalesmanReportsPage() {
  const [startDate, setStartDate] = useState(defaultStartDate());
  const [endDate, setEndDate] = useState(defaultEndDate());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const result = await window.api.reports.salesmen({ startDate, endDate });
      if (result.success) setRows(result.data.rows);
      setLoading(false);
    }
    load();
  }, [startDate, endDate]);

  const totals = rows.reduce(
    (acc, row) => ({
      sales: acc.sales + row.salesTotal,
      recovery: acc.recovery + row.recoveryTotal,
      commission: acc.commission + row.totalCommission,
    }),
    { sales: 0, recovery: 0, commission: 0 }
  );

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Salesman Reports</h2>
          <p>Sales, recovery, and commission by salesman</p>
        </div>
        <Link to="/reports" className="secondary-link">
          All Reports
        </Link>
      </div>

      <section className="document-card">
        <ReportDateRange
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
        />
        <div className="summary-cards">
          <article>
            <span>Total Sales</span>
            <strong>{totals.sales.toFixed(2)}</strong>
          </article>
          <article>
            <span>Total Recovery</span>
            <strong>{totals.recovery.toFixed(2)}</strong>
          </article>
          <article>
            <span>Total Commission</span>
            <strong>{totals.commission.toFixed(2)}</strong>
          </article>
        </div>
      </section>

      {loading ? (
        <p>Loading salesman report...</p>
      ) : (
        <DataTable columns={columns} data={rows} showActions={false} searchPlaceholder="Search salesmen..." />
      )}
    </div>
  );
}
