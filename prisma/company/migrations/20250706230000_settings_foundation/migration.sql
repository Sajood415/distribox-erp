-- CreateTable
CREATE TABLE "CompanySetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "documentType" TEXT NOT NULL PRIMARY KEY,
    "prefix" TEXT NOT NULL,
    "padding" INTEGER NOT NULL DEFAULT 6,
    "resetPolicy" TEXT NOT NULL DEFAULT 'FISCAL_YEAR',
    "currentSequence" INTEGER NOT NULL DEFAULT 0,
    "lastResetPeriod" TEXT,
    "updatedAt" DATETIME NOT NULL
);
