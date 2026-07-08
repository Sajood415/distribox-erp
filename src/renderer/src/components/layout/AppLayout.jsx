import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import useKeyboardShortcuts from "../../hooks/useKeyboardShortcuts";
import GlobalSearchBar from "../GlobalSearchBar";

const navGroups = [
  {
    title: "Main",
    links: [{ to: "/dashboard", label: "Dashboard" }],
  },
  {
    title: "Master Data",
    links: [
      { to: "/masters/units", label: "Units" },
      { to: "/masters/products", label: "Products" },
      { to: "/masters/warehouses", label: "Warehouses" },
      { to: "/masters/customers", label: "Customers" },
      { to: "/masters/vendors", label: "Vendors" },
      { to: "/masters/accounts", label: "Chart of Accounts" },
      { to: "/masters/salesmen", label: "Salesmen" },
      { to: "/masters/routes", label: "Routes" },
    ],
  },
  {
    title: "Purchase",
    links: [
      { to: "/purchase/invoices", label: "Purchase Invoices" },
      { to: "/purchase/invoices/new", label: "New Purchase" },
      { to: "/purchase/returns", label: "Purchase Returns" },
      { to: "/purchase/orders", label: "Purchase Orders" },
      { to: "/purchase/payments", label: "Supplier Payments" },
    ],
  },
  {
    title: "Inventory",
    links: [
      { to: "/inventory/stock", label: "Current Stock" },
      { to: "/inventory/opening-stock", label: "Opening Stock" },
      { to: "/inventory/stock-take", label: "Stock Take" },
      { to: "/inventory/adjustments", label: "Adjustments" },
      { to: "/inventory/transfers", label: "Transfers" },
      { to: "/inventory/product-ledger", label: "Product Ledger" },
      { to: "/inventory/warehouse-ledger", label: "Warehouse Ledger" },
      { to: "/inventory/stock-card", label: "Stock Card" },
      { to: "/inventory/movement-history", label: "Movement History" },
      { to: "/inventory/reports", label: "Low Stock & Expiry" },
    ],
  },
  {
    title: "Sales",
    links: [
      { to: "/sales/quotations", label: "Quotations" },
      { to: "/sales/invoices", label: "Sales Invoices" },
      { to: "/sales/invoices/new", label: "New Sales Invoice" },
      { to: "/sales/recovery", label: "Recovery" },
      { to: "/sales/offers", label: "Trade Offers" },
      { to: "/sales/load-slips", label: "Load Slips" },
    ],
  },
  {
    title: "Claims & Returns",
    links: [
      { to: "/claims", label: "Claims" },
      { to: "/claims/sales-returns", label: "Sales Returns" },
      { to: "/purchase/returns", label: "Purchase Returns" },
    ],
  },
  {
    title: "Reports",
    links: [
      { to: "/reports", label: "All Reports" },
      { to: "/reports/aging", label: "Aging Report" },
      { to: "/reports/balance-sheet", label: "Balance Sheet" },
      { to: "/reports/income-statement", label: "Income Statement" },
      { to: "/reports/customers", label: "Customer Reports" },
      { to: "/reports/customer-ledger", label: "Customer Ledger" },
      { to: "/reports/customer-statement", label: "Statement of Account" },
      { to: "/reports/supplier-ledger", label: "Supplier Ledger" },
      { to: "/reports/supplier-statement", label: "Supplier Statement" },
      { to: "/reports/daily-recovery", label: "Daily Recovery" },
      { to: "/reports/daily-cash", label: "Daily Cash" },
      { to: "/reports/daily-final-sheet", label: "Daily Final Sheet" },
      { to: "/reports/salesman-targets", label: "Salesman Targets" },
      { to: "/reports/routes", label: "Route Reports" },
      { to: "/reports/salesmen", label: "Salesman Reports" },
      { to: "/reports/products", label: "Product Reports" },
      { to: "/reports/purchases", label: "Purchase Report" },
    ],
  },
  {
    title: "Accounting",
    links: [
      { to: "/accounting/vouchers", label: "Vouchers" },
      { to: "/accounting/vouchers/new", label: "New Voucher" },
      { to: "/accounting/cashbook", label: "Cashbook" },
      { to: "/accounting/bankbook", label: "Bank Book" },
      { to: "/accounting/journal", label: "General Journal" },
      { to: "/accounting/periods", label: "Accounting Periods" },
      { to: "/accounting/year-close", label: "Fiscal Year Close" },
      { to: "/accounting/trial-balance", label: "Trial Balance" },
    ],
  },
  {
    title: "Settings",
    links: [{ to: "/settings", label: "Company Settings" }],
  },
  {
    title: "Tools",
    links: [
      { to: "/tools", label: "All Tools" },
      { to: "/tools/backup", label: "Backup & Restore" },
      { to: "/tools/database-health", label: "Database Health" },
      { to: "/tools/import-export", label: "Import / Export" },
    ],
  },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { helpModal } = useKeyboardShortcuts();

  return (
    <div className="app-shell with-sidebar">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <strong>Distribox ERP</strong>
          <small>{user?.company?.name ?? "No company"}</small>
        </div>
        <nav className="sidebar-nav">
          {navGroups.map((group) => (
            <div key={group.title} className="nav-group">
              <span>{group.title}</span>
              {group.links.map((link) => (
                <NavLink key={link.to} to={link.to}>
                  {link.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="app-content">
        <header className="app-header">
          <div>
            <strong>{user?.username}</strong>
            <span>{user?.role}</span>
          </div>
          <div className="header-actions">
            <GlobalSearchBar />
            <NavLink to="/company" className="secondary-link">
              Switch Company
            </NavLink>
            <button type="button" className="secondary" onClick={logout}>
              Logout
            </button>
          </div>
        </header>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
      {helpModal}
    </div>
  );
}
