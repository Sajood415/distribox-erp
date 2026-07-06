-- CreateTable
CREATE TABLE "StockMovement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "productId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "batchNo" TEXT,
    "movementType" TEXT NOT NULL,
    "documentType" TEXT,
    "documentId" INTEGER,
    "referenceNumber" TEXT,
    "quantityIn" REAL NOT NULL DEFAULT 0,
    "quantityOut" REAL NOT NULL DEFAULT 0,
    "runningQuantity" REAL NOT NULL DEFAULT 0,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "runningInventoryValue" REAL NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdBy" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StockMovement_productId_warehouseId_batchNo_date_id_idx" ON "StockMovement"("productId", "warehouseId", "batchNo", "date", "id");
CREATE INDEX "StockMovement_warehouseId_date_idx" ON "StockMovement"("warehouseId", "date");
CREATE INDEX "StockMovement_documentType_documentId_idx" ON "StockMovement"("documentType", "documentId");
CREATE INDEX "StockMovement_movementType_date_idx" ON "StockMovement"("movementType", "date");
CREATE INDEX "StockMovement_referenceNumber_idx" ON "StockMovement"("referenceNumber");
