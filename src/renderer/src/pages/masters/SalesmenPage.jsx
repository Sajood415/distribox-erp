import MasterCrudPage from "../../components/MasterCrudPage";

const columns = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "commissionRate", header: "Commission %" },
];

const fields = [
  { key: "name", label: "Salesman Name", required: true },
  { key: "commissionRate", label: "Commission Rate %", type: "number" },
];

export default function SalesmenPage() {
  return (
    <MasterCrudPage
      title="Salesmen"
      entity="salesmen"
      columns={columns}
      fields={fields}
      getDefaultRow={() => ({ commissionRate: 0 })}
    />
  );
}
