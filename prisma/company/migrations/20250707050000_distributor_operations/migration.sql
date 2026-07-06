-- AlterTable Route
ALTER TABLE "Route" ADD COLUMN "salesmanId" INTEGER;
CREATE INDEX "Route_salesmanId_idx" ON "Route"("salesmanId");

-- AlterTable PurchaseInvoice
ALTER TABLE "PurchaseInvoice" ADD COLUMN "purchaseOrderId" INTEGER;

-- AlterTable LoadSlip
-- SQLite: recreate LoadSlip with new columns
PRAGMA foreign_keys=OFF;
CREATE TABLE "LoadSlip_new" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "salesmanId" INTEGER,
    "deliveryManId" INTEGER NOT NULL,
    "routeId" INTEGER,
    "vehicleNo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LoadSlip_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "Salesman" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LoadSlip_deliveryManId_fkey" FOREIGN KEY ("deliveryManId") REFERENCES "DeliveryMan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LoadSlip_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "LoadSlip_new" ("id", "number", "date", "deliveryManId", "status", "remarks", "createdAt", "updatedAt")
SELECT "id", "number", "date", "deliveryManId",
  CASE WHEN "status" = 'Delivered' THEN 'Delivered' WHEN "status" = 'Pending' THEN 'Draft' ELSE "status" END,
  "remarks", "createdAt", "updatedAt" FROM "LoadSlip";
DROP TABLE "LoadSlip";
ALTER TABLE "LoadSlip_new" RENAME TO "LoadSlip";
CREATE UNIQUE INDEX "LoadSlip_number_key" ON "LoadSlip"("number");
PRAGMA foreign_keys=ON;

-- CreateTable LoadSlipItem
CREATE TABLE "LoadSlipItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "loadSlipId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "loadedQty" REAL NOT NULL DEFAULT 0,
    "deliveredQty" REAL NOT NULL DEFAULT 0,
    "returnedQty" REAL NOT NULL DEFAULT 0,
    "shortQty" REAL NOT NULL DEFAULT 0,
    "damageQty" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "LoadSlipItem_loadSlipId_fkey" FOREIGN KEY ("loadSlipId") REFERENCES "LoadSlip" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LoadSlipItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable PurchaseOrder
CREATE TABLE "PurchaseOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "taxTotal" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PurchaseOrder_number_key" ON "PurchaseOrder"("number");

-- CreateTable PurchaseOrderItem
CREATE TABLE "PurchaseOrderItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "purchaseOrderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "quantity" REAL NOT NULL,
    "receivedQty" REAL NOT NULL DEFAULT 0,
    "price" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "vatPercent" REAL NOT NULL DEFAULT 0,
    "lineTotal" REAL NOT NULL,
    CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable TradeOffer
CREATE TABLE "TradeOffer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "offerType" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "customerId" INTEGER,
    "productId" INTEGER,
    "category" TEXT,
    "buyQuantity" REAL,
    "getQuantity" REAL,
    "discountPercent" REAL,
    "discountAmount" REAL,
    "freeProductId" INTEGER,
    "freeQuantity" REAL,
    "slabsJson" TEXT,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TradeOffer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TradeOffer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TradeOffer_code_key" ON "TradeOffer"("code");

-- CreateTable SalesmanTarget
CREATE TABLE "SalesmanTarget" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "salesmanId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "salesTarget" REAL NOT NULL DEFAULT 0,
    "recoveryTarget" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalesmanTarget_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "Salesman" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SalesmanTarget_salesmanId_year_month_key" ON "SalesmanTarget"("salesmanId", "year", "month");

-- CreateTable ExpenseVoucher
CREATE TABLE "ExpenseVoucher" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'Cash',
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ExpenseVoucher_number_key" ON "ExpenseVoucher"("number");
