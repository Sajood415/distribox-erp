import MasterCrudPage from "../../components/MasterCrudPage";

const columns = [
  { accessorKey: "code", header: "Code" },
  { accessorKey: "name", header: "Name" },
];

const fields = [
  { key: "code", label: "Unit Code", required: true },
  { key: "name", label: "Unit Name", required: true },
];

export default function UnitsPage() {
  return <MasterCrudPage title="Units" entity="units" columns={columns} fields={fields} />;
}
