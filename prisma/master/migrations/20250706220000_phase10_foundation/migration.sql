-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "companyId" INTEGER;

-- CreateTable
CREATE TABLE "JobRunLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobName" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "durationMs" INTEGER,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "JobRunLog_jobName_startedAt_idx" ON "JobRunLog"("jobName", "startedAt");
