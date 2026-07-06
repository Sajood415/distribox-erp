import { Link } from "react-router-dom";

export default function DashboardPage() {
  const modules = [
    {
      title: "Tools",
      links: [
        { to: "/tools/backup", label: "Backup & Restore" },
        { to: "/tools/import-export", label: "Import / Export CSV" },
        { to: "#", label: "Keyboard Shortcuts (Ctrl + /)" },
      ],
    },
    {
      title: "Reports",
      links: [
        { to: "/reports/aging", label: "Aging Report" },
        { to: "/reports/balance-sheet", label: "Balance Sheet" },
        { to: "/reports/income-statement", label: "Income Statement" },
        { to: "/reports", label: "All Reports" },
      ],
    },
    {
      title: "Quick Actions",
      links: [
        { to: "/sales/invoices/new", label: "New Sales Invoice" },
        { to: "/purchase/invoices/new", label: "New Purchase" },
        { to: "/accounting/vouchers/new", label: "New Voucher" },
      ],
    },
  ];

  return (
    <div className="dashboard">
      <section className="hero-card">
        <h2>Phase 9 — Tools & Polish</h2>
        <p>
          Database backup and restore, CSV import/export, report printing, and keyboard shortcuts. All modules are now
          available in English.
        </p>
      </section>

      <section className="module-grid">
        {modules.map((module) => (
          <article key={module.title} className="module-card">
            <h3>{module.title}</h3>
            <ul>
              {module.links.map((link) => (
                <li key={link.label}>
                  {link.to === "#" ? link.label : <Link to={link.to}>{link.label}</Link>}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
