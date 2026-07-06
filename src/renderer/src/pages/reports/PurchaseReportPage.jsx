import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DataTable from "../../components/DataTable";
import ReportDateRange, { defaultEndDate, defaultStartDate } from "../../components/ReportDateRange";

const invoiceColumns = [
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
  },
  { accessorKey: "number", header: "Invoice #" },
  { accessorKey: "vendor", header: "Vendor" },
  { accessorKey: "total", header: "Total" },
  { accessorKey: "paidAmount", header: "Paid" },
  { accessorKey: "outstanding", header: "Outstanding" },
];

const vendorColumns = [
  { accessorKey: "vendor", header: "Vendor" },
  { accessorKey: "invoiceCount", header: "Invoices" },
  { accessorKey: "purchaseTotal", header: "Purchase Total" },
];

export default function PurchaseReportPage() {
  const [startDate, setStartDate] = useState(defaultStartDate());
  const [endDate, setEndDate] = useState(defaultEndDate());
  const [view, setView] = useState("invoices");
  const [report, setReport] = useState({ rows: [], byVendor: [], totalPurchases: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const result = await window.api.reports.purchases({ startDate, endDate });
      if (result.success) setReport(result.data);
      setLoading(false);
    }
    load();
  }, [startDate, endDate]);

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Purchase Report</h2>
          <p>Purchase invoices and totals by vendor</p>
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
            <span>Total Purchases</span>
            <strong>{(report.totalPurchases || 0).toFixed(2)}</strong>
          </article>
        </div>
      </section>

      <div className="filter-bar">
        <button type="button" className={view === "invoices" ? "" : "secondary"} onClick={() => setView("invoices")}>
          By Invoice
        </button>
        <button type="button" className={view === "vendor" ? "" : "secondary"} onClick={() => setView("vendor")}>
          By Vendor
        </button>
      </div>

      {loading ? (
        <p>Loading purchase report...</p>
      ) : (
        <DataTable
          columns={view === "invoices" ? invoiceColumns : vendorColumns}
          data={view === "invoices" ? report.rows : report.byVendor}
          showActions={false}
          searchPlaceholder="Search..."
        />
      )}
    </div>
  );
}
