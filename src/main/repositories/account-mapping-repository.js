export async function findMappingByRole(tx, role) {
  return tx.accountMapping.findUnique({
    where: { role },
    include: { account: true },
  });
}

export async function listMappings(tx) {
  return tx.accountMapping.findMany({
    include: { account: true },
    orderBy: { role: "asc" },
  });
}

export async function upsertMapping(tx, { role, accountId }) {
  return tx.accountMapping.upsert({
    where: { role },
    create: { role, accountId },
    update: { accountId },
  });
}

export async function findAllMappingsWithAccounts(tx) {
  return listMappings(tx);
}
