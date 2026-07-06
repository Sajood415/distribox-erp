import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable";
import PrintButton from "../../components/PrintButton";

export default function RouteReportsPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);

  useEffect(() => {
    async function load() {
      const result = await window.api.distributor.routeReport({ date });
      if (result.success) setRows(result.data.rows);
    }
    load();
  }, [date]);

  const columns = [
    { accessorKey: "route", header: "Route" },
    { accessorKey: "salesman", header: "Salesman" },
    { accessorKey: "customers", header: "Customers" },
    { accessorKey: "sales", header: "Sales" },
    { accessorKey: "recovery", header: "Recovery" },
    { accessorKey: "outstanding", header: "Outstanding" },
  ];

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Route Reports</h2>
          <p>Daily route summary — sales, recovery, outstanding</p>
        </div>
        <PrintButton title="Route Report" subtitle={date} columns={columns} rows={rows} />
      </div>
      <label>Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <DataTable columns={columns} data={rows} showActions={false} searchPlaceholder="Search routes..." />
    </div>
  );
}
