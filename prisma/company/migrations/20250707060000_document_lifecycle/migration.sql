-- CreateTable DocumentLifecycleEvent
CREATE TABLE "DocumentLifecycleEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "documentType" TEXT NOT NULL,
    "documentId" INTEGER NOT NULL,
    "documentNumber" TEXT,
    "status" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "performedBy" INTEGER,
    "performedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentDocumentType" TEXT,
    "parentDocumentId" INTEGER,
    "childDocumentType" TEXT,
    "childDocumentId" INTEGER
);
CREATE INDEX "DocumentLifecycleEvent_documentType_documentId_idx" ON "DocumentLifecycleEvent"("documentType", "documentId");
CREATE INDEX "DocumentLifecycleEvent_performedAt_idx" ON "DocumentLifecycleEvent"("performedAt");

-- Lifecycle columns (shared pattern)
ALTER TABLE "PurchaseInvoice" ADD COLUMN "lifecycleStatus" TEXT NOT NULL DEFAULT 'Posted';
ALTER TABLE "PurchaseInvoice" ADD COLUMN "createdBy" INTEGER;
ALTER TABLE "PurchaseInvoice" ADD COLUMN "postedBy" INTEGER;
ALTER TABLE "PurchaseInvoice" ADD COLUMN "postedAt" DATETIME;
ALTER TABLE "PurchaseInvoice" ADD COLUMN "cancelledBy" INTEGER;
ALTER TABLE "PurchaseInvoice" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "PurchaseInvoice" ADD COLUMN "reversedBy" INTEGER;
ALTER TABLE "PurchaseInvoice" ADD COLUMN "reversedAt" DATETIME;
ALTER TABLE "PurchaseInvoice" ADD COLUMN "lifecycleReason" TEXT;
ALTER TABLE "PurchaseInvoice" ADD COLUMN "parentDocumentType" TEXT;
ALTER TABLE "PurchaseInvoice" ADD COLUMN "parentDocumentId" INTEGER;
ALTER TABLE "PurchaseInvoice" ADD COLUMN "childDocumentType" TEXT;
ALTER TABLE "PurchaseInvoice" ADD COLUMN "childDocumentId" INTEGER;

ALTER TABLE "PurchaseReturn" ADD COLUMN "lifecycleStatus" TEXT NOT NULL DEFAULT 'Posted';
ALTER TABLE "PurchaseReturn" ADD COLUMN "createdBy" INTEGER;
ALTER TABLE "PurchaseReturn" ADD COLUMN "postedBy" INTEGER;
ALTER TABLE "PurchaseReturn" ADD COLUMN "postedAt" DATETIME;
ALTER TABLE "PurchaseReturn" ADD COLUMN "cancelledBy" INTEGER;
ALTER TABLE "PurchaseReturn" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "PurchaseReturn" ADD COLUMN "reversedBy" INTEGER;
ALTER TABLE "PurchaseReturn" ADD COLUMN "reversedAt" DATETIME;
ALTER TABLE "PurchaseReturn" ADD COLUMN "lifecycleReason" TEXT;
ALTER TABLE "PurchaseReturn" ADD COLUMN "parentDocumentType" TEXT;
ALTER TABLE "PurchaseReturn" ADD COLUMN "parentDocumentId" INTEGER;
ALTER TABLE "PurchaseReturn" ADD COLUMN "childDocumentType" TEXT;
ALTER TABLE "PurchaseReturn" ADD COLUMN "childDocumentId" INTEGER;

ALTER TABLE "PurchaseOrder" ADD COLUMN "lifecycleStatus" TEXT NOT NULL DEFAULT 'Draft';
ALTER TABLE "PurchaseOrder" ADD COLUMN "createdBy" INTEGER;
ALTER TABLE "PurchaseOrder" ADD COLUMN "postedBy" INTEGER;
ALTER TABLE "PurchaseOrder" ADD COLUMN "postedAt" DATETIME;
ALTER TABLE "PurchaseOrder" ADD COLUMN "cancelledBy" INTEGER;
ALTER TABLE "PurchaseOrder" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "PurchaseOrder" ADD COLUMN "reversedBy" INTEGER;
ALTER TABLE "PurchaseOrder" ADD COLUMN "reversedAt" DATETIME;
ALTER TABLE "PurchaseOrder" ADD COLUMN "lifecycleReason" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "parentDocumentType" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "parentDocumentId" INTEGER;
ALTER TABLE "PurchaseOrder" ADD COLUMN "childDocumentType" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "childDocumentId" INTEGER;

ALTER TABLE "SalesInvoice" ADD COLUMN "lifecycleStatus" TEXT NOT NULL DEFAULT 'Posted';
ALTER TABLE "SalesInvoice" ADD COLUMN "createdBy" INTEGER;
ALTER TABLE "SalesInvoice" ADD COLUMN "postedBy" INTEGER;
ALTER TABLE "SalesInvoice" ADD COLUMN "postedAt" DATETIME;
ALTER TABLE "SalesInvoice" ADD COLUMN "cancelledBy" INTEGER;
ALTER TABLE "SalesInvoice" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "SalesInvoice" ADD COLUMN "reversedBy" INTEGER;
ALTER TABLE "SalesInvoice" ADD COLUMN "reversedAt" DATETIME;
ALTER TABLE "SalesInvoice" ADD COLUMN "lifecycleReason" TEXT;
ALTER TABLE "SalesInvoice" ADD COLUMN "parentDocumentType" TEXT;
ALTER TABLE "SalesInvoice" ADD COLUMN "parentDocumentId" INTEGER;
ALTER TABLE "SalesInvoice" ADD COLUMN "childDocumentType" TEXT;
ALTER TABLE "SalesInvoice" ADD COLUMN "childDocumentId" INTEGER;

ALTER TABLE "SalesReturn" ADD COLUMN "lifecycleStatus" TEXT NOT NULL DEFAULT 'Posted';
ALTER TABLE "SalesReturn" ADD COLUMN "createdBy" INTEGER;
ALTER TABLE "SalesReturn" ADD COLUMN "postedBy" INTEGER;
ALTER TABLE "SalesReturn" ADD COLUMN "postedAt" DATETIME;
ALTER TABLE "SalesReturn" ADD COLUMN "cancelledBy" INTEGER;
ALTER TABLE "SalesReturn" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "SalesReturn" ADD COLUMN "reversedBy" INTEGER;
ALTER TABLE "SalesReturn" ADD COLUMN "reversedAt" DATETIME;
ALTER TABLE "SalesReturn" ADD COLUMN "lifecycleReason" TEXT;
ALTER TABLE "SalesReturn" ADD COLUMN "parentDocumentType" TEXT;
ALTER TABLE "SalesReturn" ADD COLUMN "parentDocumentId" INTEGER;
ALTER TABLE "SalesReturn" ADD COLUMN "childDocumentType" TEXT;
ALTER TABLE "SalesReturn" ADD COLUMN "childDocumentId" INTEGER;

ALTER TABLE "RecoveryVoucher" ADD COLUMN "lifecycleStatus" TEXT NOT NULL DEFAULT 'Posted';
ALTER TABLE "RecoveryVoucher" ADD COLUMN "createdBy" INTEGER;
ALTER TABLE "RecoveryVoucher" ADD COLUMN "postedBy" INTEGER;
ALTER TABLE "RecoveryVoucher" ADD COLUMN "postedAt" DATETIME;
ALTER TABLE "RecoveryVoucher" ADD COLUMN "cancelledBy" INTEGER;
ALTER TABLE "RecoveryVoucher" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "RecoveryVoucher" ADD COLUMN "reversedBy" INTEGER;
ALTER TABLE "RecoveryVoucher" ADD COLUMN "reversedAt" DATETIME;
ALTER TABLE "RecoveryVoucher" ADD COLUMN "lifecycleReason" TEXT;
ALTER TABLE "RecoveryVoucher" ADD COLUMN "parentDocumentType" TEXT;
ALTER TABLE "RecoveryVoucher" ADD COLUMN "parentDocumentId" INTEGER;
ALTER TABLE "RecoveryVoucher" ADD COLUMN "childDocumentType" TEXT;
ALTER TABLE "RecoveryVoucher" ADD COLUMN "childDocumentId" INTEGER;

ALTER TABLE "Claim" ADD COLUMN "lifecycleStatus" TEXT NOT NULL DEFAULT 'Draft';
ALTER TABLE "Claim" ADD COLUMN "createdBy" INTEGER;
ALTER TABLE "Claim" ADD COLUMN "postedBy" INTEGER;
ALTER TABLE "Claim" ADD COLUMN "postedAt" DATETIME;
ALTER TABLE "Claim" ADD COLUMN "cancelledBy" INTEGER;
ALTER TABLE "Claim" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "Claim" ADD COLUMN "reversedBy" INTEGER;
ALTER TABLE "Claim" ADD COLUMN "reversedAt" DATETIME;
ALTER TABLE "Claim" ADD COLUMN "lifecycleReason" TEXT;
ALTER TABLE "Claim" ADD COLUMN "parentDocumentType" TEXT;
ALTER TABLE "Claim" ADD COLUMN "parentDocumentId" INTEGER;
ALTER TABLE "Claim" ADD COLUMN "childDocumentType" TEXT;
ALTER TABLE "Claim" ADD COLUMN "childDocumentId" INTEGER;

ALTER TABLE "ExpenseVoucher" ADD COLUMN "lifecycleStatus" TEXT NOT NULL DEFAULT 'Posted';
ALTER TABLE "ExpenseVoucher" ADD COLUMN "createdBy" INTEGER;
ALTER TABLE "ExpenseVoucher" ADD COLUMN "postedBy" INTEGER;
ALTER TABLE "ExpenseVoucher" ADD COLUMN "postedAt" DATETIME;
ALTER TABLE "ExpenseVoucher" ADD COLUMN "cancelledBy" INTEGER;
ALTER TABLE "ExpenseVoucher" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "ExpenseVoucher" ADD COLUMN "reversedBy" INTEGER;
ALTER TABLE "ExpenseVoucher" ADD COLUMN "reversedAt" DATETIME;
ALTER TABLE "ExpenseVoucher" ADD COLUMN "lifecycleReason" TEXT;
ALTER TABLE "ExpenseVoucher" ADD COLUMN "parentDocumentType" TEXT;
ALTER TABLE "ExpenseVoucher" ADD COLUMN "parentDocumentId" INTEGER;
ALTER TABLE "ExpenseVoucher" ADD COLUMN "childDocumentType" TEXT;
ALTER TABLE "ExpenseVoucher" ADD COLUMN "childDocumentId" INTEGER;

ALTER TABLE "StockAdjustment" ADD COLUMN "lifecycleStatus" TEXT NOT NULL DEFAULT 'Posted';
ALTER TABLE "StockAdjustment" ADD COLUMN "createdBy" INTEGER;
ALTER TABLE "StockAdjustment" ADD COLUMN "postedBy" INTEGER;
ALTER TABLE "StockAdjustment" ADD COLUMN "postedAt" DATETIME;
ALTER TABLE "StockAdjustment" ADD COLUMN "cancelledBy" INTEGER;
ALTER TABLE "StockAdjustment" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "StockAdjustment" ADD COLUMN "reversedBy" INTEGER;
ALTER TABLE "StockAdjustment" ADD COLUMN "reversedAt" DATETIME;
ALTER TABLE "StockAdjustment" ADD COLUMN "lifecycleReason" TEXT;
ALTER TABLE "StockAdjustment" ADD COLUMN "parentDocumentType" TEXT;
ALTER TABLE "StockAdjustment" ADD COLUMN "parentDocumentId" INTEGER;
ALTER TABLE "StockAdjustment" ADD COLUMN "childDocumentType" TEXT;
ALTER TABLE "StockAdjustment" ADD COLUMN "childDocumentId" INTEGER;

ALTER TABLE "Quotation" ADD COLUMN "lifecycleStatus" TEXT NOT NULL DEFAULT 'Draft';
ALTER TABLE "Quotation" ADD COLUMN "createdBy" INTEGER;
ALTER TABLE "Quotation" ADD COLUMN "postedBy" INTEGER;
ALTER TABLE "Quotation" ADD COLUMN "postedAt" DATETIME;
ALTER TABLE "Quotation" ADD COLUMN "cancelledBy" INTEGER;
ALTER TABLE "Quotation" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "Quotation" ADD COLUMN "reversedBy" INTEGER;
ALTER TABLE "Quotation" ADD COLUMN "reversedAt" DATETIME;
ALTER TABLE "Quotation" ADD COLUMN "lifecycleReason" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "parentDocumentType" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "parentDocumentId" INTEGER;
ALTER TABLE "Quotation" ADD COLUMN "childDocumentType" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "childDocumentId" INTEGER;

ALTER TABLE "LoadSlip" ADD COLUMN "lifecycleStatus" TEXT NOT NULL DEFAULT 'Draft';
ALTER TABLE "LoadSlip" ADD COLUMN "createdBy" INTEGER;
ALTER TABLE "LoadSlip" ADD COLUMN "postedBy" INTEGER;
ALTER TABLE "LoadSlip" ADD COLUMN "postedAt" DATETIME;
ALTER TABLE "LoadSlip" ADD COLUMN "cancelledBy" INTEGER;
ALTER TABLE "LoadSlip" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "LoadSlip" ADD COLUMN "reversedBy" INTEGER;
ALTER TABLE "LoadSlip" ADD COLUMN "reversedAt" DATETIME;
ALTER TABLE "LoadSlip" ADD COLUMN "lifecycleReason" TEXT;
ALTER TABLE "LoadSlip" ADD COLUMN "parentDocumentType" TEXT;
ALTER TABLE "LoadSlip" ADD COLUMN "parentDocumentId" INTEGER;
ALTER TABLE "LoadSlip" ADD COLUMN "childDocumentType" TEXT;
ALTER TABLE "LoadSlip" ADD COLUMN "childDocumentId" INTEGER;
