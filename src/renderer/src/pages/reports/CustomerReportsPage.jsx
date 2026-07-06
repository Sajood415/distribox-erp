import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DataTable from "../../components/DataTable";
import ReportDateRange, { defaultEndDate, defaultStartDate } from "../../components/ReportDateRange";

const TABS = [
  { id: "outstanding", label: "Outstanding" },
  { id: "sales", label: "Sales Summary" },
  { id: "recovery", label: "Recovery" },
];

export default function CustomerReportsPage() {
  const [tab, setTab] = useState("outstanding");
  const [startDate, setStartDate] = useState(defaultStartDate());
  const [endDate, setEndDate] = useState(defaultEndDate());
  const [data, setData] = useState({ rows: [], totalOutstanding: 0, totalSales: 0, totalRecovered: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      if (tab === "outstanding") {
        const result = await window.api.reports.customerOutstanding();
        if (result.success) setData({ rows: result.data.rows, totalOutstanding: result.data.totalOutstanding });
      } else if (tab === "sales") {
        const result = await window.api.reports.customerSales({ startDate, endDate });
        if (result.success) setData({ rows: result.data.rows, totalSales: result.data.totalSales });
      } else {
        const result = await window.api.reports.recovery({ startDate, endDate });
        if (result.success) setData({ rows: result.data.rows, totalRecovered: result.data.totalRecovered });
      }
      setLoading(false);
    }
    load();
  }, [tab, startDate, endDate]);

  const columns =
    tab === "outstanding"
      ? [
          { accessorKey: "code", header: "Code" },
          { accessorKey: "name", header: "Customer" },
          { accessorKey: "salesman", header: "Salesman" },
          { accessorKey: "creditLimit", header: "Credit Limit" },
          { accessorKey: "outstanding", header: "Outstanding" },
          { accessorKey: "available", header: "Available" },
        ]
      : tab === "sales"
        ? [
            { accessorKey: "code", header: "Code" },
            { accessorKey: "name", header: "Customer" },
            { accessorKey: "invoiceCount", header: "Invoices" },
            { accessorKey: "salesTotal", header: "Sales Total" },
            { accessorKey: "paidAmount", header: "Collected" },
          ]
        : [
            {
              accessorKey: "date",
              header: "Date",
              cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
            },
            { accessorKey: "number", header: "Voucher #" },
            { accessorKey: "customer", header: "Customer" },
            { accessorKey: "salesman", header: "Salesman" },
            { accessorKey: "paymentMode", header: "Mode" },
            { accessorKey: "amount", header: "Amount" },
          ];

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Customer Reports</h2>
          <p>Outstanding balances, sales summaries, and recovery history</p>
        </div>
        <Link to="/reports" className="secondary-link">
          All Reports
        </Link>
      </div>

      <div className="filter-bar">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "" : "secondary"}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab !== "outstanding" && (
        <section className="document-card">
          <ReportDateRange
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />
        </section>
      )}

      {tab === "outstanding" && (
        <section className="document-card">
          <div className="summary-cards">
            <article>
              <span>Total Outstanding</span>
              <strong>{(data.totalOutstanding || 0).toFixed(2)}</strong>
            </article>
          </div>
        </section>
      )}
      {tab === "sales" && (
        <section className="document-card">
          <div className="summary-cards">
            <article>
              <span>Total Sales</span>
              <strong>{(data.totalSales || 0).toFixed(2)}</strong>
            </article>
          </div>
        </section>
      )}
      {tab === "recovery" && (
        <section className="document-card">
          <div className="summary-cards">
            <article>
              <span>Total Recovered</span>
              <strong>{(data.totalRecovered || 0).toFixed(2)}</strong>
            </article>
          </div>
        </section>
      )}

      {loading ? (
        <p>Loading report...</p>
      ) : (
        <DataTable columns={columns} data={data.rows} showActions={false} searchPlaceholder="Search..." />
      )}
    </div>
  );
}
