import { useEffect, useState } from "react";
import StockLedgerReportPage from "../../components/StockLedgerReportPage";

export default function MovementHistoryPage() {
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

  return (
    <StockLedgerReportPage
      title="Movement History"
      description="Search all inventory movements across the company"
      lookups={lookups}
      loadLedger={(payload) => window.api.stockLedger.movements(payload)}
      filters={{
        lookups,
        values,
        setValue,
        ready: true,
        hint: "Use filters to narrow movement history.",
        fields: (
          <>
            <label>
              Product
              <select value={values.productId} onChange={(e) => setValue("productId", e.target.value)}>
                <option value="">All products</option>
                {lookups.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.code} — {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Warehouse
              <select value={values.warehouseId} onChange={(e) => setValue("warehouseId", e.target.value)}>
                <option value="">All warehouses</option>
                {lookups.warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Batch
              <input
                value={values.batchNo}
                onChange={(e) => setValue("batchNo", e.target.value)}
                placeholder="Batch number"
              />
            </label>
          </>
        ),
      }}
    />
  );
}
