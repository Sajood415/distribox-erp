-- Phase 10.3: Vendor payment vouchers for supplier sub-ledger
CREATE TABLE "VendorPaymentVoucher" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'Cash',
    "amount" REAL NOT NULL,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VendorPaymentVoucher_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "VendorPaymentItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vendorPaymentVoucherId" INTEGER NOT NULL,
    "purchaseInvoiceId" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    CONSTRAINT "VendorPaymentItem_vendorPaymentVoucherId_fkey" FOREIGN KEY ("vendorPaymentVoucherId") REFERENCES "VendorPaymentVoucher" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VendorPaymentItem_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "VendorPaymentVoucher_number_key" ON "VendorPaymentVoucher"("number");
