import { Link } from "react-router-dom";

const tools = [
  {
    title: "Data Safety",
    items: [
      { to: "/tools/backup", label: "Backup & Restore", desc: "Backup or restore master and company databases" },
      { to: "/tools/database-health", label: "Database Health", desc: "Journal balance and mapping integrity checks" },
    ],
  },
  {
    title: "Data Exchange",
    items: [
      { to: "/tools/import-export", label: "Import / Export", desc: "CSV export and import for products, customers, vendors" },
    ],
  },
  {
    title: "Productivity",
    items: [
      { to: "#", label: "Keyboard Shortcuts", desc: "Press Ctrl + / anywhere in the app" },
    ],
  },
];

export default function ToolsHubPage() {
  return (
    <div className="dashboard">
      <section className="hero-card">
        <h2>Tools</h2>
        <p>Backup, restore, CSV import/export, and printing utilities.</p>
      </section>

      <section className="module-grid">
        {tools.map((group) => (
          <article key={group.title} className="module-card">
            <h3>{group.title}</h3>
            <ul>
              {group.items.map((item) => (
                <li key={item.label}>
                  {item.to === "#" ? item.label : <Link to={item.to}>{item.label}</Link>}
                  <small>{item.desc}</small>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
