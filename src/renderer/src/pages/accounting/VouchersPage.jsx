import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import DataTable from "../../components/DataTable";

const VOUCHER_TYPES = [
  { value: "", label: "All Types" },
  { value: "Opening", label: "Opening" },
  { value: "Payment", label: "Payment" },
  { value: "Receiving", label: "Receiving" },
  { value: "Journal", label: "Journal" },
  { value: "BankPayment", label: "Bank Payment" },
  { value: "BankReceiving", label: "Bank Receiving" },
];

const columns = [
  { accessorKey: "number", header: "Voucher #" },
  { accessorKey: "type", header: "Type" },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
  },
  { accessorKey: "description", header: "Description" },
  { accessorKey: "amount", header: "Amount" },
];

export default function VouchersPage() {
  const [searchParams] = useSearchParams();
  const [filterType, setFilterType] = useState(searchParams.get("type") || "");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const result = await window.api.accounting.listVouchers(
        filterType ? { type: filterType } : {}
      );
      if (result.success) setRows(result.data);
      setLoading(false);
    }
    load();
  }, [filterType]);

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Vouchers</h2>
          <p>Payment, receiving, journal, and opening vouchers</p>
        </div>
        <Link to="/accounting/vouchers/new" className="primary-link-button">
          New Voucher
        </Link>
      </div>

      <div className="filter-bar">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          {VOUCHER_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p>Loading vouchers...</p>
      ) : (
        <DataTable columns={columns} data={rows} showActions={false} searchPlaceholder="Search vouchers..." />
      )}
    </div>
  );
}
