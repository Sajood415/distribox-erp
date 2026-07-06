import MasterCrudPage from "../../components/MasterCrudPage";

const columns = [
  { accessorKey: "code", header: "Code" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "city", header: "City" },
  { accessorKey: "paymentTerms", header: "Payment Terms" },
  { accessorKey: "openingBalance", header: "Opening Balance" },
];

const fields = [
  { key: "code", label: "Vendor Code", required: true },
  { key: "name", label: "Vendor Name", required: true },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "paymentTerms", label: "Payment Terms (days)", type: "number" },
  { key: "creditLimit", label: "Credit Limit", type: "number" },
  { key: "strn", label: "STRN" },
  { key: "openingBalance", label: "Opening Balance", type: "number" },
];

export default function VendorsPage() {
  return (
    <MasterCrudPage
      title="Vendors"
      entity="vendors"
      columns={columns}
      fields={fields}
      getDefaultRow={() => ({ paymentTerms: 30 })}
    />
  );
}
