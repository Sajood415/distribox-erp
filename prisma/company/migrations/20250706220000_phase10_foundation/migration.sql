-- CreateTable
CREATE TABLE "CompanyAuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "table" TEXT NOT NULL,
    "recordId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CompanyEventLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER,
    "referenceNumber" TEXT,
    "message" TEXT NOT NULL,
    "performedBy" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StoredDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "documentType" TEXT NOT NULL,
    "documentId" INTEGER NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL DEFAULT 'v1',
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" INTEGER
);

-- CreateIndex
CREATE INDEX "CompanyAuditLog_table_recordId_idx" ON "CompanyAuditLog"("table", "recordId");

-- CreateIndex
CREATE INDEX "CompanyAuditLog_timestamp_idx" ON "CompanyAuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "CompanyEventLog_createdAt_idx" ON "CompanyEventLog"("createdAt");

-- CreateIndex
CREATE INDEX "CompanyEventLog_entityType_entityId_idx" ON "CompanyEventLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "StoredDocument_documentNumber_idx" ON "StoredDocument"("documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StoredDocument_documentType_documentId_templateVersion_key" ON "StoredDocument"("documentType", "documentId", "templateVersion");
