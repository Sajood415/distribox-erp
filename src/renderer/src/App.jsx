import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import CompanySelectorPage from "./pages/CompanySelectorPage";
import DashboardPage from "./pages/DashboardPage";
import AppLayout from "./components/layout/AppLayout";
import UnitsPage from "./pages/masters/UnitsPage";
import ProductsPage from "./pages/masters/ProductsPage";
import WarehousesPage from "./pages/masters/WarehousesPage";
import CustomersPage from "./pages/masters/CustomersPage";
import VendorsPage from "./pages/masters/VendorsPage";
import AccountsPage from "./pages/masters/AccountsPage";
import SalesmenPage from "./pages/masters/SalesmenPage";
import RoutesPage from "./pages/masters/RoutesPage";
import PurchaseInvoicesPage from "./pages/purchase/PurchaseInvoicesPage";
import PurchaseInvoiceFormPage from "./pages/purchase/PurchaseInvoiceFormPage";
import PurchaseReturnsPage from "./pages/purchase/PurchaseReturnsPage";
import VendorPaymentPage from "./pages/purchase/VendorPaymentPage";
import PurchaseOrdersPage from "./pages/purchase/PurchaseOrdersPage";
import StockPage from "./pages/inventory/StockPage";
import OpeningStockPage from "./pages/inventory/OpeningStockPage";
import StockTakePage from "./pages/inventory/StockTakePage";
import StockAdjustmentsPage from "./pages/inventory/StockAdjustmentsPage";
import StockTransfersPage from "./pages/inventory/StockTransfersPage";
import InventoryReportsPage from "./pages/inventory/InventoryReportsPage";
import ProductLedgerPage from "./pages/inventory/ProductLedgerPage";
import WarehouseLedgerPage from "./pages/inventory/WarehouseLedgerPage";
import BatchLedgerPage from "./pages/inventory/BatchLedgerPage";
import StockCardPage from "./pages/inventory/StockCardPage";
import MovementHistoryPage from "./pages/inventory/MovementHistoryPage";
import QuotationsPage from "./pages/sales/QuotationsPage";
import SalesInvoicesPage from "./pages/sales/SalesInvoicesPage";
import SalesInvoiceFormPage from "./pages/sales/SalesInvoiceFormPage";
import RecoveryPage from "./pages/sales/RecoveryPage";
import TradeOffersPage from "./pages/sales/TradeOffersPage";
import LoadSlipsPage from "./pages/sales/LoadSlipsPage";
import VouchersPage from "./pages/accounting/VouchersPage";
import VoucherFormPage from "./pages/accounting/VoucherFormPage";
import CashbookPage from "./pages/accounting/CashbookPage";
import BankbookPage from "./pages/accounting/BankbookPage";
import TrialBalancePage from "./pages/accounting/TrialBalancePage";
import JournalPage from "./pages/accounting/JournalPage";
import AccountingPeriodsPage from "./pages/accounting/AccountingPeriodsPage";
import FiscalYearClosePage from "./pages/accounting/FiscalYearClosePage";
import ClaimsPage from "./pages/claims/ClaimsPage";
import SalesReturnsPage from "./pages/claims/SalesReturnsPage";
import ReportsHubPage from "./pages/reports/ReportsHubPage";
import AgingReportPage from "./pages/reports/AgingReportPage";
import BalanceSheetPage from "./pages/reports/BalanceSheetPage";
import IncomeStatementPage from "./pages/reports/IncomeStatementPage";
import CustomerReportsPage from "./pages/reports/CustomerReportsPage";
import SalesmanReportsPage from "./pages/reports/SalesmanReportsPage";
import ProductReportsPage from "./pages/reports/ProductReportsPage";
import PurchaseReportPage from "./pages/reports/PurchaseReportPage";
import CustomerLedgerPage from "./pages/reports/CustomerLedgerPage";
import SupplierLedgerPage from "./pages/reports/SupplierLedgerPage";
import OutstandingStatementPage from "./pages/reports/OutstandingStatementPage";
import CustomerStatementPage from "./pages/reports/CustomerStatementPage";
import SupplierStatementPage from "./pages/reports/SupplierStatementPage";
import DailyRecoveryReportsPage from "./pages/reports/DailyRecoveryReportsPage";
import DailyCashPage from "./pages/reports/DailyCashPage";
import DailyFinalSheetPage from "./pages/reports/DailyFinalSheetPage";
import SalesmanTargetsPage from "./pages/reports/SalesmanTargetsPage";
import RouteReportsPage from "./pages/reports/RouteReportsPage";
import YearCloseReportPage from "./pages/reports/YearCloseReportPage";
import OpeningBalanceReportPage from "./pages/reports/OpeningBalanceReportPage";
import DatabaseHealthPage from "./pages/tools/DatabaseHealthPage";
import ToolsHubPage from "./pages/tools/ToolsHubPage";
import BackupPage from "./pages/tools/BackupPage";
import ImportExportPage from "./pages/tools/ImportExportPage";
import SettingsPage from "./pages/settings/SettingsPage";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="page-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/company" replace /> : <LoginPage />}
      />
      <Route
        path="/company"
        element={
          <ProtectedRoute>
            <CompanySelectorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="masters/units" element={<UnitsPage />} />
        <Route path="masters/products" element={<ProductsPage />} />
        <Route path="masters/warehouses" element={<WarehousesPage />} />
        <Route path="masters/customers" element={<CustomersPage />} />
        <Route path="masters/vendors" element={<VendorsPage />} />
        <Route path="masters/accounts" element={<AccountsPage />} />
        <Route path="masters/salesmen" element={<SalesmenPage />} />
        <Route path="masters/routes" element={<RoutesPage />} />
        <Route path="purchase/invoices" element={<PurchaseInvoicesPage />} />
        <Route path="purchase/invoices/new" element={<PurchaseInvoiceFormPage />} />
        <Route path="purchase/returns" element={<PurchaseReturnsPage />} />
        <Route path="purchase/payments" element={<VendorPaymentPage />} />
        <Route path="purchase/orders" element={<PurchaseOrdersPage />} />
        <Route path="inventory/stock" element={<StockPage />} />
        <Route path="inventory/opening-stock" element={<OpeningStockPage />} />
        <Route path="inventory/stock-take" element={<StockTakePage />} />
        <Route path="inventory/adjustments" element={<StockAdjustmentsPage />} />
        <Route path="inventory/transfers" element={<StockTransfersPage />} />
        <Route path="inventory/reports" element={<InventoryReportsPage />} />
        <Route path="inventory/product-ledger" element={<ProductLedgerPage />} />
        <Route path="inventory/warehouse-ledger" element={<WarehouseLedgerPage />} />
        <Route path="inventory/batch-ledger" element={<BatchLedgerPage />} />
        <Route path="inventory/stock-card" element={<StockCardPage />} />
        <Route path="inventory/movement-history" element={<MovementHistoryPage />} />
        <Route path="inventory/history" element={<MovementHistoryPage />} />
        <Route path="sales/quotations" element={<QuotationsPage />} />
        <Route path="sales/invoices" element={<SalesInvoicesPage />} />
        <Route path="sales/invoices/new" element={<SalesInvoiceFormPage />} />
        <Route path="sales/recovery" element={<RecoveryPage />} />
        <Route path="sales/offers" element={<TradeOffersPage />} />
        <Route path="sales/load-slips" element={<LoadSlipsPage />} />
        <Route path="accounting/vouchers" element={<VouchersPage />} />
        <Route path="accounting/vouchers/new" element={<VoucherFormPage />} />
        <Route path="accounting/cashbook" element={<CashbookPage />} />
        <Route path="accounting/bankbook" element={<BankbookPage />} />
        <Route path="accounting/trial-balance" element={<TrialBalancePage />} />
        <Route path="accounting/journal" element={<JournalPage />} />
        <Route path="accounting/periods" element={<AccountingPeriodsPage />} />
        <Route path="accounting/year-close" element={<FiscalYearClosePage />} />
        <Route path="claims" element={<ClaimsPage />} />
        <Route path="claims/sales-returns" element={<SalesReturnsPage />} />
        <Route path="reports" element={<ReportsHubPage />} />
        <Route path="reports/aging" element={<AgingReportPage />} />
        <Route path="reports/balance-sheet" element={<BalanceSheetPage />} />
        <Route path="reports/income-statement" element={<IncomeStatementPage />} />
        <Route path="reports/customers" element={<CustomerReportsPage />} />
        <Route path="reports/salesmen" element={<SalesmanReportsPage />} />
        <Route path="reports/products" element={<ProductReportsPage />} />
        <Route path="reports/purchases" element={<PurchaseReportPage />} />
        <Route path="reports/customer-ledger" element={<CustomerLedgerPage />} />
        <Route path="reports/supplier-ledger" element={<SupplierLedgerPage />} />
        <Route path="reports/outstanding-statement" element={<OutstandingStatementPage />} />
        <Route path="reports/customer-statement" element={<CustomerStatementPage />} />
        <Route path="reports/supplier-statement" element={<SupplierStatementPage />} />
        <Route path="reports/daily-recovery" element={<DailyRecoveryReportsPage />} />
        <Route path="reports/daily-cash" element={<DailyCashPage />} />
        <Route path="reports/daily-final-sheet" element={<DailyFinalSheetPage />} />
        <Route path="reports/salesman-targets" element={<SalesmanTargetsPage />} />
        <Route path="reports/routes" element={<RouteReportsPage />} />
        <Route path="reports/year-close" element={<YearCloseReportPage />} />
        <Route path="reports/opening-balances" element={<OpeningBalanceReportPage />} />
        <Route path="tools" element={<ToolsHubPage />} />
        <Route path="tools/backup" element={<BackupPage />} />
        <Route path="tools/database-health" element={<DatabaseHealthPage />} />
        <Route path="tools/import-export" element={<ImportExportPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  );
}
