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

export default function ProductLedgerPage() {
  const filters = useStockFilters(["productId"]);

  return (
    <StockLedgerReportPage
      title="Product Ledger"
      description="Complete inventory movement history by product"
      lookups={filters.lookups}
      loadLedger={(payload) => window.api.stockLedger.product(payload)}
      filters={{
        ...filters,
        hint: "Select a product to view movements.",
        fields: (
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
        ),
      }}
    />
  );
}
