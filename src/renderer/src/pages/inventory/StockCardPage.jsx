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

export default function StockCardPage() {
  const filters = useStockFilters(["productId", "warehouseId"]);

  return (
    <StockLedgerReportPage
      title="Stock Card"
      description="Product stock card for a single warehouse location"
      lookups={filters.lookups}
      loadLedger={(payload) => window.api.stockLedger.card(payload)}
      filters={{
        ...filters,
        hint: "Select product and warehouse to view the stock card.",
        fields: (
          <>
            <label>
              Product
              <select value={filters.values.productId} onChange={(e) => filters.setValue("productId", e.target.value)}>
                <option value="">Select product</option>
                {filters.lookups.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.code} — {product.name}
                  </option>
                ))}
              </select>
            </label>
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
          </>
        ),
      }}
    />
  );
}
