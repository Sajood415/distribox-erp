import { useEffect, useState } from "react";
import LedgerReportPage from "../../components/LedgerReportPage";

export default function SupplierLedgerPage() {
  const [parties, setParties] = useState([]);
  const [partyId, setPartyId] = useState("");

  useEffect(() => {
    async function load() {
      const result = await window.api.reports.subLedgerLookups();
      if (result.success) setParties(result.data.vendors);
    }
    load();
  }, []);

  return (
    <LedgerReportPage
      title="Supplier Ledger"
      partyLabel="Supplier"
      partyId={partyId}
      setPartyId={setPartyId}
      parties={parties}
      loadLedger={(filters) =>
        window.api.reports.supplierLedger({
          vendorId: filters.partyId,
          startDate: filters.startDate,
          endDate: filters.endDate,
          documentType: filters.documentType,
          reference: filters.reference,
        })
      }
      backLink="/reports"
    />
  );
}
