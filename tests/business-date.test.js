import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setBusinessDateOverride,
  clearBusinessDateOverride,
  getBusinessDate,
  getCurrentFiscalYear,
  getCurrentPeriod,
  getFiscalYearStartMonth,
} from "../src/main/domain/business-date.js";

describe("business-date", () => {
  afterEach(() => {
    clearBusinessDateOverride();
  });

  it("returns override when set", () => {
    setBusinessDateOverride("2026-03-15T10:00:00.000Z");
    expect(getBusinessDate().toISOString()).toBe("2026-03-15T10:00:00.000Z");
  });

  it("calculates Pakistan fiscal year July-June", () => {
    setBusinessDateOverride("2026-01-15");
    const fy = getCurrentFiscalYear();
    expect(fy.label).toBe("FY2025-26");
    expect(getFiscalYearStartMonth()).toBe(7);
  });

  it("returns current calendar period", () => {
    setBusinessDateOverride("2026-05-10");
    const period = getCurrentPeriod();
    expect(period.year).toBe(2026);
    expect(period.month).toBe(5);
    expect(period.label).toBe("2026-05");
  });
});
