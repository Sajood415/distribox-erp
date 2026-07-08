import { getBusinessDate, startOfDay } from "../domain/business-date";
import { isEnabled } from "../core/feature-flags";
import { SETTING_KEYS } from "../core/settings-keys";
import { getSettingValue } from "./settings-service";
import { FISCAL_YEAR_STATUS, ACCOUNTING_PERIOD_STATUS } from "../core/period-status";
import { findPeriodForDate } from "./fiscal-period-service";

function settingEnabled(value, defaultValue = false) {
  if (value == null || value === "") return defaultValue;
  return String(value).toLowerCase() === "true";
}

function formatPeriodLabel(period) {
  if (!period) return "unknown period";
  const year = period.startDate.getFullYear();
  const month = String(period.month).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Validates that a posting date is allowed under period locking rules.
 * Called from journal-repository before any journal is persisted.
 */
export async function assertPeriodOpenForPosting(tx, postingDate, context = {}) {
  if (!isEnabled("ENABLE_PERIOD_LOCKING")) return;

  const date = startOfDay(new Date(postingDate));
  const businessDate = startOfDay(getBusinessDate());

  const [allowFuture, allowBackdated] = await Promise.all([
    getSettingValue(SETTING_KEYS.ALLOW_FUTURE_POSTING, tx),
    getSettingValue(SETTING_KEYS.ALLOW_BACKDATED_POSTING, tx),
  ]);

  if (date > businessDate && !settingEnabled(allowFuture, false)) {
    throw new Error(
      "Future posting is not allowed. Enable 'Allow Future Posting' in company settings or use the current business date."
    );
  }

  const period = await findPeriodForDate(tx, date);
  if (!period) {
    throw new Error(`No accounting period exists for posting date ${date.toISOString().slice(0, 10)}`);
  }

  if (period.fiscalYear?.status === FISCAL_YEAR_STATUS.ARCHIVED) {
    throw new Error(`Fiscal year ${period.fiscalYear.name} is archived. Posting is not allowed.`);
  }

  if (period.fiscalYear?.status === FISCAL_YEAR_STATUS.CLOSED) {
    throw new Error(`Fiscal year ${period.fiscalYear.name} is closed. Posting is not allowed.`);
  }

  if (period.status === ACCOUNTING_PERIOD_STATUS.CLOSED) {
    throw new Error(
      `Accounting period ${formatPeriodLabel(period)} is closed. ` +
        "Reopen the period or post to an open period."
    );
  }

  if (date < businessDate && !settingEnabled(allowBackdated, true)) {
    throw new Error(
      `Backdated posting to ${date.toISOString().slice(0, 10)} is not allowed. ` +
        "Enable 'Allow Backdated Posting' in company settings."
    );
  }

  return period;
}
