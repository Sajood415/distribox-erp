import { useEffect, useState } from "react";
import StockLedgerReportPage from "../../components/StockLedgerReportPage";

function useStockFilters(requiredKeys) {
  const [lookups, setLookups] = useState({ products: [], warehouses: [] });
  const [values, setValues] = useState({
    productId: "",
    warehouseId: "",
    batchNo: "",
    movementType: "",
    reference: "",
  });

  useEffect(() => {
    async function load() {
      const result = await window.api.stockLedger.lookups();
      if (result.success) setLookups(result.data);
    }
    load();
  }, []);

  const setValue = (key, val) => setValues((prev) => ({ ...prev, [key]: val }));
  const ready = requiredKeys.every((key) => values[key]);

  return { lookups, values, setValue, ready };
}

export default function WarehouseLedgerPage() {
  const filters = useStockFilters(["warehouseId"]);

  return (
    <StockLedgerReportPage
      title="Warehouse Ledger"
      description="All stock movements for a warehouse"
      lookups={filters.lookups}
      loadLedger={(payload) => window.api.stockLedger.warehouse(payload)}
      filters={{
        ...filters,
        hint: "Select a warehouse to view movements.",
        fields: (
          <label>
            Warehouse
            <select
              value={filters.values.warehouseId}
              onChange={(e) => filters.setValue("warehouseId", e.target.value)}
            >
              <option value="">Select warehouse</option>
              {filters.lookups.warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>
        ),
      }}
    />
  );
}
