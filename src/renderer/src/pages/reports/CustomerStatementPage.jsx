import { useEffect, useState } from "react";
import LedgerReportPage from "../../components/LedgerReportPage";

export default function CustomerStatementPage() {
  const [parties, setParties] = useState([]);
  const [partyId, setPartyId] = useState("");

  useEffect(() => {
    async function load() {
      const result = await window.api.reports.subLedgerLookups();
      if (result.success) setParties(result.data.customers);
    }
    load();
  }, []);

  return (
    <LedgerReportPage
      title="Statement of Account"
      partyLabel="Customer"
      partyId={partyId}
      setPartyId={setPartyId}
      parties={parties}
      loadLedger={(filters) =>
        window.api.reports.customerStatement({
          customerId: filters.partyId,
          startDate: filters.startDate,
          endDate: filters.endDate,
          documentType: filters.documentType,
          reference: filters.reference,
        })
      }
    />
  );
}
