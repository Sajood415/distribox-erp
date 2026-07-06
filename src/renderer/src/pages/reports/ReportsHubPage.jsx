import { Link } from "react-router-dom";

const reportGroups = [
  {
    title: "Financial Statements",
    reports: [
      { to: "/reports/aging", label: "Aging Report", desc: "Customer outstanding by due-date buckets" },
      { to: "/reports/balance-sheet", label: "Balance Sheet", desc: "Assets, liabilities, and equity" },
      { to: "/reports/income-statement", label: "Income Statement", desc: "Revenue, COGS, expenses, net profit" },
      { to: "/accounting/trial-balance", label: "Trial Balance", desc: "Debit and credit account totals" },
      { to: "/accounting/cashbook", label: "Cashbook", desc: "Cash receipts and payments" },
    ],
  },
  {
    title: "Customer & Sales",
    reports: [
      { to: "/reports/customers", label: "Customer Reports", desc: "Outstanding balances, sales, recovery" },
      { to: "/reports/salesmen", label: "Salesman Reports", desc: "Sales, recovery, and commission" },
    ],
  },
  {
    title: "Product & Purchase",
    reports: [
      { to: "/reports/products", label: "Product Reports", desc: "Sales performance and stock valuation" },
      { to: "/reports/purchases", label: "Purchase Report", desc: "Purchases by vendor and invoice" },
      { to: "/inventory/reports", label: "Low Stock & Expiry", desc: "Inventory alerts" },
    ],
  },
];

export default function ReportsHubPage() {
  return (
    <div className="dashboard">
      <section className="hero-card">
        <h2>Reports</h2>
        <p>Financial statements, aging, customer balances, salesman performance, and inventory reports.</p>
      </section>

      <section className="module-grid">
        {reportGroups.map((group) => (
          <article key={group.title} className="module-card">
            <h3>{group.title}</h3>
            <ul>
              {group.reports.map((report) => (
                <li key={report.to}>
                  <Link to={report.to}>{report.label}</Link>
                  <small>{report.desc}</small>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
