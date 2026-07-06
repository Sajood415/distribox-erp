-- AlterTable JournalEntry
ALTER TABLE "JournalEntry" ADD COLUMN "referenceNumber" TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN "sourceDocumentType" TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN "sourceDocumentId" INTEGER;
ALTER TABLE "JournalEntry" ADD COLUMN "postingDate" DATETIME;

UPDATE "JournalEntry"
SET
  "referenceNumber" = "reference",
  "postingDate" = "date",
  "sourceDocumentType" = "sourceType"
WHERE "postingDate" IS NULL;

-- Rename LedgerLine to JournalLine
ALTER TABLE "LedgerLine" RENAME TO "JournalLine";
ALTER TABLE "JournalLine" RENAME COLUMN "entryId" TO "journalEntryId";
ALTER TABLE "JournalLine" RENAME COLUMN "narrative" TO "description";

-- CreateTable AccountMapping
CREATE TABLE "AccountMapping" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "role" TEXT NOT NULL,
    "accountId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AccountMapping_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AccountMapping_role_key" ON "AccountMapping"("role");
