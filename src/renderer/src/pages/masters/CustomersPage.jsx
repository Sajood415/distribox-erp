import MasterCrudPage from "../../components/MasterCrudPage";

const columns = [
  { accessorKey: "code", header: "Code" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "city", header: "City" },
  { accessorKey: "creditDays", header: "Credit Days" },
  { accessorKey: "creditLimit", header: "Credit Limit" },
  {
    accessorKey: "salesman",
    header: "Salesman",
    cell: ({ row }) => row.original.salesman?.name ?? "-",
  },
];

const fields = [
  { key: "code", label: "Customer Code", required: true },
  { key: "name", label: "Customer Name", required: true },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "area", label: "Area" },
  { key: "salesmanId", label: "Salesman", type: "select", optionsKey: "salesmen", optionLabel: "name" },
  { key: "routeId", label: "Route", type: "select", optionsKey: "routes", optionLabel: "name" },
  { key: "creditDays", label: "Credit Days", type: "number" },
  { key: "creditLimit", label: "Credit Limit", type: "number" },
  { key: "ntn", label: "NTN" },
  { key: "strn", label: "STRN" },
  { key: "openingBalance", label: "Opening Balance", type: "number" },
];

export default function CustomersPage() {
  return <MasterCrudPage title="Customers" entity="customers" columns={columns} fields={fields} />;
}
