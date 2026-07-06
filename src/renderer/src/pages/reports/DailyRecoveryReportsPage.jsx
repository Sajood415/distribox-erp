import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable";
import PrintButton from "../../components/PrintButton";

const tabs = [
  { id: "sheet", label: "Recovery Sheet" },
  { id: "salesman", label: "By Salesman" },
  { id: "customer", label: "By Customer" },
  { id: "pending", label: "Pending Recovery" },
  { id: "performance", label: "Performance" },
  { id: "aging", label: "Recovery Aging" },
];

export default function DailyRecoveryReportsPage() {
  const [tab, setTab] = useState("sheet");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState({ rows: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const loaders = {
        sheet: () => window.api.distributor.recoverySheet({ date }),
        salesman: () => window.api.distributor.recoveryBySalesman({ date }),
        customer: () => window.api.distributor.recoveryByCustomer({ date }),
        pending: () => window.api.distributor.pendingRecovery(),
        performance: () => window.api.distributor.recoveryPerformance({ date }),
        aging: () => window.api.distributor.recoveryAging({ asOfDate: date }),
      };
      const result = await loaders[tab]();
      if (result.success) setData(result.data);
      setLoading(false);
    }
    load();
  }, [tab, date]);

  const columns = tab === "customer" || tab === "pending"
    ? [
        { accessorKey: "code", header: "Code" },
        { accessorKey: "name", header: "Customer" },
        { accessorKey: "outstanding", header: "Outstanding" },
      ]
    : tab === "aging"
      ? [
          { accessorKey: "customer", header: "Customer" },
          { accessorKey: "salesman", header: "Salesman" },
          { accessorKey: "outstanding", header: "Outstanding" },
          { accessorKey: "bucket", header: "Bucket" },
        ]
      : [
          { accessorKey: "number", header: "Reference" },
          { accessorKey: "customer", header: "Customer" },
          { accessorKey: "salesman", header: "Salesman" },
          { accessorKey: "amount", header: "Amount" },
        ];

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Daily Recovery</h2>
          <p>Recovery sheets, performance, and outstanding recovery</p>
        </div>
        <PrintButton title="Daily Recovery" columns={columns} rows={data.rows || []} />
      </div>

      <div className="filter-bar">
        {tabs.map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? "" : "secondary"} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <label>
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      {loading ? <p>Loading...</p> : <DataTable columns={columns} data={data.rows || []} showActions={false} searchPlaceholder="Search..." />}
    </div>
  );
}
