import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DataTable from "../../components/DataTable";
import PrintButton from "../../components/PrintButton";
import ReportDateRange, { defaultEndDate } from "../../components/ReportDateRange";

const columns = [
  { accessorKey: "customerCode", header: "Code" },
  { accessorKey: "customerName", header: "Customer" },
  { accessorKey: "salesman", header: "Salesman" },
  { accessorKey: "current", header: "0–30 Days" },
  { accessorKey: "days31_60", header: "31–60 Days" },
  { accessorKey: "days61_90", header: "61–90 Days" },
  { accessorKey: "days91_120", header: "91–120 Days" },
  { accessorKey: "days120Plus", header: "120+ Days" },
  { accessorKey: "total", header: "Total" },
];

export default function AgingReportPage() {
  const [asOfDate, setAsOfDate] = useState(defaultEndDate());
  const [report, setReport] = useState({ rows: [], totals: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const result = await window.api.reports.aging({ asOfDate });
      if (result.success) setReport(result.data);
      setLoading(false);
    }
    load();
  }, [asOfDate]);

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Aging Report</h2>
          <p>Outstanding customer balances grouped by days overdue</p>
        </div>
        <div className="header-actions-row">
          <Link to="/reports" className="secondary-link">
            All Reports
          </Link>
          <PrintButton
            title="Aging Report"
            subtitle={`As of ${asOfDate}`}
            columns={columns}
            rows={report.rows}
            summary={[{ label: "Total Outstanding", value: (report.totals?.total || 0).toFixed(2) }]}
          />
        </div>
      </div>

      <section className="document-card">
        <ReportDateRange showAsOf asOfDate={asOfDate} onAsOfChange={setAsOfDate} />
        {report.totals && (
          <div className="summary-cards">
            <article>
              <span>0–30 Days</span>
              <strong>{(report.totals.current || 0).toFixed(2)}</strong>
            </article>
            <article>
              <span>31–60 Days</span>
              <strong>{(report.totals.days31_60 || 0).toFixed(2)}</strong>
            </article>
            <article>
              <span>61–90 Days</span>
              <strong>{(report.totals.days61_90 || 0).toFixed(2)}</strong>
            </article>
            <article>
              <span>120+ Days</span>
              <strong>{(report.totals.days120Plus || 0).toFixed(2)}</strong>
            </article>
            <article>
              <span>Total Outstanding</span>
              <strong>{(report.totals.total || 0).toFixed(2)}</strong>
            </article>
          </div>
        )}
      </section>

      {loading ? (
        <p>Loading aging report...</p>
      ) : (
        <DataTable columns={columns} data={report.rows} showActions={false} searchPlaceholder="Search customers..." />
      )}
    </div>
  );
}
