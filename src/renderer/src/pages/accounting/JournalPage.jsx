import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable";
import { todayInputValue } from "../../utils/purchase";

export default function JournalPage() {
  const [startDate, setStartDate] = useState(todayInputValue().slice(0, 8) + "01");
  const [endDate, setEndDate] = useState(todayInputValue());
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [ledgerAccountId, setLedgerAccountId] = useState("");
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [journalResult, lookupResult] = await Promise.all([
        window.api.accounting.listJournal({ startDate, endDate }),
        window.api.accounting.lookups(),
      ]);
      if (journalResult.success) setEntries(journalResult.data);
      if (lookupResult.success) setAccounts(lookupResult.data.accounts);
      setLoading(false);
    }
    load();
  }, [startDate, endDate]);

  useEffect(() => {
    async function loadLedger() {
      if (!ledgerAccountId) {
        setLedger(null);
        return;
      }
      const result = await window.api.accounting.accountLedger({
        accountId: Number(ledgerAccountId),
        startDate,
        endDate,
      });
      if (result.success) setLedger(result.data);
    }
    loadLedger();
  }, [ledgerAccountId, startDate, endDate]);

  const journalRows = entries.flatMap((entry) =>
    entry.lines.map((line) => ({
      id: `${entry.id}-${line.id}`,
      date: entry.date,
      reference: entry.reference,
      sourceType: entry.sourceType,
      description: entry.description,
      account: `${line.account.code} - ${line.account.name}`,
      debit: line.debit,
      credit: line.credit,
    }))
  );

  const ledgerColumns = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
    },
    { accessorKey: "reference", header: "Ref" },
    { accessorKey: "description", header: "Description" },
    { accessorKey: "debit", header: "Debit" },
    { accessorKey: "credit", header: "Credit" },
    { accessorKey: "balance", header: "Balance" },
  ];

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>General Journal</h2>
          <p>All journal entries and account ledger drill-down</p>
        </div>
      </div>

      <section className="document-card">
        <div className="document-grid">
          <label>
            From
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label>
            Account Ledger
            <select value={ledgerAccountId} onChange={(e) => setLedgerAccountId(e.target.value)}>
              <option value="">All journal lines below</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {loading ? (
        <p>Loading journal...</p>
      ) : ledger ? (
        <>
          <p className="hint-text">
            Ledger: {ledger.account.code} - {ledger.account.name} · Closing {ledger.closing.toFixed(2)}
          </p>
          <DataTable columns={ledgerColumns} data={ledger.rows} showActions={false} />
        </>
      ) : (
        <DataTable
          columns={[
            {
              accessorKey: "date",
              header: "Date",
              cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
            },
            { accessorKey: "reference", header: "Ref" },
            { accessorKey: "sourceType", header: "Source" },
            { accessorKey: "description", header: "Description" },
            { accessorKey: "account", header: "Account" },
            { accessorKey: "debit", header: "Debit" },
            { accessorKey: "credit", header: "Credit" },
          ]}
          data={journalRows}
          showActions={false}
          searchPlaceholder="Search journal..."
        />
      )}
    </div>
  );
}
