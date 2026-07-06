/**
 * BusinessDateService — business services must use this instead of new Date().
 * Supports override for testing, backdated posting, and fiscal simulation.
 */
let businessDateOverride = null;
let fiscalYearStartMonthOverride = null;

const DEFAULT_FISCAL_YEAR_START_MONTH = 7;

export function setBusinessDateOverride(date) {
  businessDateOverride = date ? new Date(date) : null;
}

export function clearBusinessDateOverride() {
  businessDateOverride = null;
}

export function setFiscalYearStartMonth(month) {
  fiscalYearStartMonthOverride = month;
}

export function getFiscalYearStartMonth() {
  return fiscalYearStartMonthOverride ?? DEFAULT_FISCAL_YEAR_START_MONTH;
}

export function getBusinessDate() {
  if (businessDateOverride) {
    return new Date(businessDateOverride);
  }
  return new Date();
}

export function getCurrentAccountingDate() {
  const date = getBusinessDate();
  return startOfDay(date);
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function getFiscalYearBounds(referenceDate = getBusinessDate(), startMonth = getFiscalYearStartMonth()) {
  const date = new Date(referenceDate);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  let startYear = year;
  if (month < startMonth) {
    startYear = year - 1;
  }

  const start = new Date(startYear, startMonth - 1, 1);
  const end = new Date(startYear + 1, startMonth - 1, 0, 23, 59, 59, 999);

  const endYearShort = String((startYear + 1) % 100).padStart(2, "0");
  const label = `FY${startYear}-${endYearShort}`;

  return { label, start, end, startYear, endYear: startYear + 1 };
}

export function getCurrentFiscalYear(referenceDate = getBusinessDate()) {
  return getFiscalYearBounds(referenceDate);
}

export function getCurrentPeriod(referenceDate = getBusinessDate()) {
  const date = new Date(referenceDate);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return {
    year,
    month,
    label: `${year}-${String(month).padStart(2, "0")}`,
    start,
    end,
  };
}

export function isDateInFiscalYear(date, fiscalYearLabel, startMonth = getFiscalYearStartMonth()) {
  const bounds = getFiscalYearBounds(date, startMonth);
  return bounds.label === fiscalYearLabel;
}
