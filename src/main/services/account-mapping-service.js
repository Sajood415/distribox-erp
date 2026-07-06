import { DEFAULT_ROLE_ACCOUNT_CODES } from "../core/account-roles";
import { findAccountByCode } from "../repositories/account-repository";
import {
  findMappingByRole,
  listMappings,
  upsertMapping,
} from "../repositories/account-mapping-repository";

export async function seedAccountMappings(prisma) {
  for (const [role, code] of Object.entries(DEFAULT_ROLE_ACCOUNT_CODES)) {
    const account = await findAccountByCode(prisma, code);
    if (!account) continue;

    const existing = await findMappingByRole(prisma, role);
    if (!existing) {
      await upsertMapping(prisma, { role, accountId: account.id });
    }
  }
}

export async function resolveAccountIdByRole(tx, role) {
  const mapping = await findMappingByRole(tx, role);
  if (!mapping?.accountId) {
    throw new Error(`Account mapping not configured for role: ${role}`);
  }
  return mapping.accountId;
}

export async function getAccountMappings() {
  const { getCompanyPrisma } = await import("../db/init");
  const prisma = getCompanyPrisma();
  const mappings = await listMappings(prisma);

  const map = {};
  for (const row of mappings) {
    map[row.role] = {
      role: row.role,
      accountId: row.accountId,
      accountCode: row.account.code,
      accountName: row.account.name,
    };
  }

  return { success: true, data: { mappings: map, rows: mappings } };
}

export async function saveAccountMapping(payload) {
  const { getCompanyPrisma } = await import("../db/init");
  const prisma = getCompanyPrisma();
  const { role, accountId } = payload;

  if (!role || !accountId) {
    return { success: false, error: "Role and account are required" };
  }

  await upsertMapping(prisma, { role, accountId: Number(accountId) });
  return getAccountMappings();
}
