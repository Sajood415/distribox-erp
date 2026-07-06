import { describe, it, expect } from "vitest";
import { assertBalanced } from "../src/main/domain/journal-balancer";

describe("sales invoice freight journal", () => {
  it("balances AR with revenue, tax, freight, and COGS lines", () => {
    const invoice = {
      subtotal: 1000,
      taxTotal: 150,
      freight: 50,
      total: 1200,
      cogsTotal: 600,
      isCredit: true,
      paidAmount: 0,
    };

    const lines = [
      { accountRole: "ACCOUNTS_RECEIVABLE", debit: invoice.total, credit: 0 },
      { accountRole: "SALES_REVENUE", debit: 0, credit: invoice.subtotal },
      { accountRole: "TAX_PAYABLE", debit: 0, credit: invoice.taxTotal },
      { accountRole: "FREIGHT_INCOME", debit: 0, credit: invoice.freight },
      { accountRole: "COGS", debit: invoice.cogsTotal, credit: 0 },
      { accountRole: "INVENTORY", debit: 0, credit: invoice.cogsTotal },
    ];

    const { totalDebit, totalCredit } = assertBalanced(lines);
    expect(totalDebit).toBe(1800);
    expect(totalCredit).toBe(1800);
  });

  it("balances cash sale with freight and no COGS", () => {
    const lines = [
      { accountRole: "CASH", debit: 525, credit: 0 },
      { accountRole: "SALES_REVENUE", debit: 0, credit: 500 },
      { accountRole: "FREIGHT_INCOME", debit: 0, credit: 25 },
    ];

    expect(() => assertBalanced(lines)).not.toThrow();
  });
});
