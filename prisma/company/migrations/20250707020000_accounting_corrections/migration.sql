-- Phase 10.2.1: Accounting corrections — new chart accounts (also seeded in app if missing)
INSERT INTO "Account" ("code", "name", "type", "updatedAt")
SELECT '2200', 'Tax Payable', 'Liability', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Account" WHERE "code" = '2200');

INSERT INTO "Account" ("code", "name", "type", "updatedAt")
SELECT '4100', 'Freight Income', 'Income', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Account" WHERE "code" = '4100');

INSERT INTO "Account" ("code", "name", "type", "updatedAt")
SELECT '5200', 'Inventory Adjustment Gain', 'Income', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Account" WHERE "code" = '5200');

INSERT INTO "Account" ("code", "name", "type", "updatedAt")
SELECT '5210', 'Inventory Adjustment Loss', 'Expense', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Account" WHERE "code" = '5210');

INSERT INTO "CompanySetting" ("key", "value", "updatedAt")
SELECT 'credit_limit_policy', 'BLOCK', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "CompanySetting" WHERE "key" = 'credit_limit_policy');
