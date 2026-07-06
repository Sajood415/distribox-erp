import MasterCrudPage from "../../components/MasterCrudPage";

const columns = [{ accessorKey: "name", header: "Route Name" }];
const fields = [{ key: "name", label: "Route Name", required: true }];

export default function RoutesPage() {
  return <MasterCrudPage title="Routes" entity="routes" columns={columns} fields={fields} />;
}
