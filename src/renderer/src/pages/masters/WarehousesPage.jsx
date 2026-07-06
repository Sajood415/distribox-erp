import MasterCrudPage from "../../components/MasterCrudPage";

const columns = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "address", header: "Address" },
];

const fields = [
  { key: "name", label: "Warehouse Name", required: true },
  { key: "address", label: "Address" },
];

export default function WarehousesPage() {
  return <MasterCrudPage title="Warehouses" entity="warehouses" columns={columns} fields={fields} />;
}
