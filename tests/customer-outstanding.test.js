import { describe, it, expect } from "vitest";
import { roundMoney } from "../src/main/utils/money";

function computeOutstanding({ opening = 0, sales = 0, recovery = 0, salesReturns = 0 }) {
  return roundMoney(opening + sales - recovery - salesReturns);
}

describe("customer outstanding formula", () => {
  it("applies opening + sales - recovery - sales returns", () => {
    expect(computeOutstanding({
      opening: 1000,
      sales: 5000,
      recovery: 2000,
      salesReturns: 500,
    })).toBe(3500);
  });

  it("returns opening balance when no movement", () => {
    expect(computeOutstanding({ opening: 750 })).toBe(750);
  });

  it("reduces outstanding when sales returns exist without recovery", () => {
    expect(computeOutstanding({
      opening: 0,
      sales: 1000,
      recovery: 0,
      salesReturns: 200,
    })).toBe(800);
  });
});
