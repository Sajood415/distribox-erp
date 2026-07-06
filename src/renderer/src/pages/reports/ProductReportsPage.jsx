import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DataTable from "../../components/DataTable";
import ReportDateRange, { defaultEndDate, defaultStartDate } from "../../components/ReportDateRange";

const TABS = [
  { id: "sales", label: "Product Sales" },
  { id: "stock", label: "Stock Valuation" },
];

export default function ProductReportsPage() {
  const [tab, setTab] = useState("sales");
  const [startDate, setStartDate] = useState(defaultStartDate());
  const [endDate, setEndDate] = useState(defaultEndDate());
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      if (tab === "sales") {
        const result = await window.api.reports.productSales({ startDate, endDate });
        if (result.success) {
          setRows(result.data.rows);
          setSummary({ totalSales: result.data.totalSales, totalProfit: result.data.totalProfit });
        }
      } else {
        const result = await window.api.reports.stockValuation();
        if (result.success) {
          setRows(result.data.rows);
          setSummary({ totalValue: result.data.totalValue, totalQuantity: result.data.totalQuantity });
        }
      }
      setLoading(false);
    }
    load();
  }, [tab, startDate, endDate]);

  const salesColumns = [
    { accessorKey: "code", header: "Code" },
    { accessorKey: "name", header: "Product" },
    { accessorKey: "quantity", header: "Qty Sold" },
    { accessorKey: "salesValue", header: "Sales" },
    { accessorKey: "cogs", header: "COGS" },
    { accessorKey: "profit", header: "Profit" },
  ];

  const stockColumns = [
    { accessorKey: "productCode", header: "Code" },
    { accessorKey: "productName", header: "Product" },
    { accessorKey: "warehouse", header: "Warehouse" },
    { accessorKey: "batchNo", header: "Batch" },
    { accessorKey: "quantity", header: "Qty" },
    { accessorKey: "costPerUnit", header: "Unit Cost" },
    { accessorKey: "value", header: "Value" },
  ];

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Product Reports</h2>
          <p>Sales performance and stock valuation</p>
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

      <section className="document-card">
        {tab === "sales" && (
          <ReportDateRange
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />
        )}
        <div className="summary-cards">
          {tab === "sales" ? (
            <>
              <article>
                <span>Total Sales</span>
                <strong>{(summary.totalSales || 0).toFixed(2)}</strong>
              </article>
              <article>
                <span>Total Profit</span>
                <strong>{(summary.totalProfit || 0).toFixed(2)}</strong>
              </article>
            </>
          ) : (
            <>
              <article>
                <span>Total Stock Value</span>
                <strong>{(summary.totalValue || 0).toFixed(2)}</strong>
              </article>
              <article>
                <span>Total Quantity</span>
                <strong>{(summary.totalQuantity || 0).toFixed(2)}</strong>
              </article>
            </>
          )}
        </div>
      </section>

      {loading ? (
        <p>Loading product report...</p>
      ) : (
        <DataTable
          columns={tab === "sales" ? salesColumns : stockColumns}
          data={rows}
          showActions={false}
          searchPlaceholder="Search products..."
        />
      )}
    </div>
  );
}
