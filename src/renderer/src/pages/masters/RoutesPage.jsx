import MasterCrudPage from "../../components/MasterCrudPage";

const columns = [
  { accessorKey: "name", header: "Route Name" },
  {
    accessorKey: "salesman",
    header: "Salesman",
    cell: ({ row }) => row.original.salesman?.name ?? "-",
  },
  {
    accessorKey: "_count",
    header: "Customers",
    cell: ({ row }) => row.original._count?.customers ?? 0,
  },
];

const fields = [
  { key: "name", label: "Route Name", required: true },
  {
    key: "salesmanId",
    label: "Salesman",
    type: "select",
    optionsKey: "salesmen",
    optionLabel: "name",
  },
];

export default function RoutesPage() {
  return <MasterCrudPage title="Routes" entity="routes" columns={columns} fields={fields} />;
}
