async function getAccountId(tx, code) {
  const account = await tx.account.findUnique({ where: { code } });
  if (!account) {
    throw new Error(`Account ${code} not found in chart of accounts`);
  }
  return account.id;
}

export async function postJournalEntry(tx, { date, description, reference, sourceType = "System", lines }) {
  const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error("Journal entry is not balanced");
  }

  return tx.journalEntry.create({
    data: {
      date: new Date(date),
      description,
      reference,
      sourceType,
      lines: {
        create: lines.map((line) => ({
          accountId: line.accountId,
          debit: line.debit || 0,
          credit: line.credit || 0,
          narrative: line.narrative || null,
        })),
      },
    },
  });
}

export async function postPurchaseJournal(tx, invoice) {
  const inventoryId = await getAccountId(tx, "1300");
  const apId = await getAccountId(tx, "2100");
  const cashId = await getAccountId(tx, "1100");

  const inventoryAmount = invoice.subtotal + invoice.freight + invoice.taxTotal;
  const lines = [{ accountId: inventoryId, debit: inventoryAmount, credit: 0 }];

  if (invoice.isCredit) {
    lines.push({ accountId: apId, debit: 0, credit: invoice.total });
    if (invoice.paidAmount > 0) {
      lines.push({ accountId: apId, debit: invoice.paidAmount, credit: 0 });
      lines.push({ accountId: cashId, debit: 0, credit: invoice.paidAmount });
    }
  } else {
    lines.push({ accountId: cashId, debit: 0, credit: invoice.total });
  }

  return postJournalEntry(tx, {
    date: invoice.date,
    description: `Purchase Invoice ${invoice.number}`,
    reference: invoice.number,
    lines,
  });
}

export async function postPurchaseReturnJournal(tx, purchaseReturn) {
  const inventoryId = await getAccountId(tx, "1300");
  const apId = await getAccountId(tx, "2100");

  return postJournalEntry(tx, {
    date: purchaseReturn.date,
    description: `Purchase Return ${purchaseReturn.number}`,
    reference: purchaseReturn.number,
    lines: [
      { accountId: apId, debit: purchaseReturn.total, credit: 0 },
      { accountId: inventoryId, debit: 0, credit: purchaseReturn.total },
    ],
  });
}

export async function postSalesJournal(tx, invoice) {
  const arId = await getAccountId(tx, "1400");
  const cashId = await getAccountId(tx, "1100");
  const revenueId = await getAccountId(tx, "4000");
  const cogsId = await getAccountId(tx, "5000");
  const inventoryId = await getAccountId(tx, "1300");

  const revenueAmount = invoice.subtotal + invoice.taxTotal;
  const lines = [
    { accountId: revenueId, debit: 0, credit: revenueAmount },
    { accountId: cogsId, debit: invoice.cogsTotal, credit: 0 },
    { accountId: inventoryId, debit: 0, credit: invoice.cogsTotal },
  ];

  if (invoice.isCredit) {
    lines.unshift({ accountId: arId, debit: invoice.total, credit: 0 });
    if (invoice.paidAmount > 0) {
      lines.push({ accountId: arId, debit: 0, credit: invoice.paidAmount });
      lines.push({ accountId: cashId, debit: invoice.paidAmount, credit: 0 });
    }
  } else {
    lines.unshift({ accountId: cashId, debit: invoice.total, credit: 0 });
  }

  return postJournalEntry(tx, {
    date: invoice.date,
    description: `Sales Invoice ${invoice.number}`,
    reference: invoice.number,
    lines,
  });
}

export async function postRecoveryJournal(tx, recovery) {
  const arId = await getAccountId(tx, "1400");
  const cashId = await getAccountId(tx, "1100");
  const bankId = await getAccountId(tx, "1200");
  const creditAccountId = recovery.paymentMode === "Bank" ? bankId : cashId;

  return postJournalEntry(tx, {
    date: recovery.date,
    description: `Recovery ${recovery.number}`,
    reference: recovery.number,
    lines: [
      { accountId: creditAccountId, debit: recovery.amount, credit: 0 },
      { accountId: arId, debit: 0, credit: recovery.amount },
    ],
  });
}

export async function postSalesReturnJournal(tx, salesReturn) {
  const arId = await getAccountId(tx, "1400");
  const revenueId = await getAccountId(tx, "4000");
  const inventoryId = await getAccountId(tx, "1300");
  const cogsId = await getAccountId(tx, "5000");
  const cogsTotal = salesReturn.cogsTotal || 0;

  return postJournalEntry(tx, {
    date: salesReturn.date,
    description: `Sales Return ${salesReturn.number}`,
    reference: salesReturn.number,
    sourceType: "SalesReturn",
    lines: [
      { accountId: revenueId, debit: salesReturn.total, credit: 0 },
      { accountId: arId, debit: 0, credit: salesReturn.total },
      ...(cogsTotal > 0
        ? [
            { accountId: inventoryId, debit: cogsTotal, credit: 0 },
            { accountId: cogsId, debit: 0, credit: cogsTotal },
          ]
        : []),
    ],
  });
}

export async function postClaimWriteOffJournal(tx, claim) {
  const inventoryId = await getAccountId(tx, "1300");
  const expenseId = await getAccountId(tx, "5100");
  const writeOffValue = claim.cogsTotal || claim.total;

  return postJournalEntry(tx, {
    date: claim.date,
    description: `Claim Write-off ${claim.number}`,
    reference: claim.number,
    sourceType: "Claim",
    lines: [
      { accountId: expenseId, debit: writeOffValue, credit: 0 },
      { accountId: inventoryId, debit: 0, credit: writeOffValue },
    ],
  });
}
