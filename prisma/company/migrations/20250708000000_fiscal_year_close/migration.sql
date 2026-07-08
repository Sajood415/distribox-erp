-- Phase 10.8: Fiscal Year Closing

ALTER TABLE "FiscalYear" ADD COLUMN "closedAt" DATETIME;
ALTER TABLE "FiscalYear" ADD COLUMN "closedBy" TEXT;

CREATE TABLE "YearCloseSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fiscalYearId" INTEGER NOT NULL,
    "fiscalYearName" TEXT NOT NULL,
    "newFiscalYearId" INTEGER,
    "newFiscalYearName" TEXT,
    "closedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedBy" TEXT,
    "inventoryValuation" REAL NOT NULL DEFAULT 0,
    "customerOutstanding" REAL NOT NULL DEFAULT 0,
    "supplierOutstanding" REAL NOT NULL DEFAULT 0,
    "cashPosition" REAL NOT NULL DEFAULT 0,
    "bankPosition" REAL NOT NULL DEFAULT 0,
    "retainedEarnings" REAL NOT NULL DEFAULT 0,
    "trialBalanceJson" TEXT NOT NULL,
    "balanceSheetJson" TEXT NOT NULL,
    "incomeStatementJson" TEXT NOT NULL,
    "customerBalancesJson" TEXT,
    "supplierBalancesJson" TEXT,
    "glBalancesJson" TEXT,
    "stockSnapshotJson" TEXT,
    CONSTRAINT "YearCloseSnapshot_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "YearCloseSnapshot_fiscalYearId_idx" ON "YearCloseSnapshot"("fiscalYearId");
CREATE INDEX "YearCloseSnapshot_closedAt_idx" ON "YearCloseSnapshot"("closedAt");
