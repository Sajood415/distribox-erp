import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable";

export default function SalesmanTargetsPage() {
  const [rows, setRows] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [form, setForm] = useState({
    salesmanId: "",
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    salesTarget: 0,
    recoveryTarget: 0,
  });

  async function load() {
    const [targets, perf, lookup] = await Promise.all([
      window.api.salesmanOps.listTargets(),
      window.api.salesmanOps.performance({ year: form.year, month: form.month }),
      window.api.masters.lookups(),
    ]);
    if (targets.success) setRows(targets.data);
    if (perf.success) setPerformance(perf.data.rows);
    if (lookup.success) setSalesmen(lookup.data.salesmen || []);
  }

  useEffect(() => { load(); }, [form.year, form.month]);

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Salesman Targets & Performance</h2>
          <p>Monthly targets, achievement %, commission foundation</p>
        </div>
      </div>

      <section className="document-card">
        <div className="document-grid">
          <label>
            Salesman
            <select value={form.salesmanId} onChange={(e) => setForm({ ...form, salesmanId: e.target.value })}>
              <option value="">Select</option>
              {salesmen.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>Year<input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></label>
          <label>Month<input type="number" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} /></label>
          <label>Sales Target<input type="number" value={form.salesTarget} onChange={(e) => setForm({ ...form, salesTarget: e.target.value })} /></label>
          <label>Recovery Target<input type="number" value={form.recoveryTarget} onChange={(e) => setForm({ ...form, recoveryTarget: e.target.value })} /></label>
        </div>
        <button type="button" onClick={async () => { const r = await window.api.salesmanOps.saveTarget(form); if (!r.success) alert(r.error); else load(); }}>
          Save Target
        </button>
      </section>

      <DataTable
        columns={[
          { accessorKey: "salesman", header: "Salesman" },
          { accessorKey: "salesTarget", header: "Sales Target" },
          { accessorKey: "actualSales", header: "Actual Sales" },
          { accessorKey: "salesAchievement", header: "Sales %" },
          { accessorKey: "recoveryTarget", header: "Recovery Target" },
          { accessorKey: "actualRecovery", header: "Actual Recovery" },
          { accessorKey: "recoveryAchievement", header: "Recovery %" },
          { accessorKey: "commission", header: "Commission" },
        ]}
        data={performance}
        showActions={false}
        searchPlaceholder="Search salesmen..."
      />
    </div>
  );
}
