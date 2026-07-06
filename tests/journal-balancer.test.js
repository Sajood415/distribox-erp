import { describe, it, expect } from "vitest";
import { assertBalanced, sumDebits, sumCredits } from "../src/main/domain/journal-balancer.js";

describe("journal-balancer", () => {
  it("accepts balanced journal lines", () => {
    const lines = [
      { debit: 100, credit: 0 },
      { debit: 0, credit: 100 },
    ];
    expect(sumDebits(lines)).toBe(100);
    expect(sumCredits(lines)).toBe(100);
    expect(() => assertBalanced(lines)).not.toThrow();
  });

  it("rejects unbalanced journal lines", () => {
    const lines = [
      { debit: 100, credit: 0 },
      { debit: 0, credit: 90 },
    ];
    expect(() => assertBalanced(lines)).toThrow(/not balanced/i);
  });
});
