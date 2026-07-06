import { todayInputValue } from "../utils/purchase";

export default function ReportDateRange({ startDate, endDate, onStartChange, onEndChange, showAsOf, asOfDate, onAsOfChange }) {
  if (showAsOf) {
    return (
      <div className="document-grid">
        <label>
          As of Date
          <input type="date" value={asOfDate} onChange={(e) => onAsOfChange(e.target.value)} />
        </label>
      </div>
    );
  }

  return (
    <div className="document-grid">
      <label>
        From
        <input type="date" value={startDate} onChange={(e) => onStartChange(e.target.value)} />
      </label>
      <label>
        To
        <input type="date" value={endDate} onChange={(e) => onEndChange(e.target.value)} />
      </label>
    </div>
  );
}

export function defaultStartDate() {
  return todayInputValue().slice(0, 8) + "01";
}

export function defaultEndDate() {
  return todayInputValue();
}
