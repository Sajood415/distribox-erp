export async function findAccountByCode(tx, code) {
  return tx.account.findUnique({ where: { code } });
}

export async function listAccounts(tx) {
  return tx.account.findMany({ orderBy: { code: "asc" } });
}
