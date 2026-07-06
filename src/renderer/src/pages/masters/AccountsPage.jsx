import MasterCrudPage from "../../components/MasterCrudPage";

const ACCOUNT_TYPES = [
  { value: "Asset", label: "Asset" },
  { value: "Liability", label: "Liability" },
  { value: "Equity", label: "Equity" },
  { value: "Income", label: "Income" },
  { value: "Expense", label: "Expense" },
];

const columns = [
  { accessorKey: "code", header: "Code" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "type", header: "Type" },
];

const fields = [
  { key: "code", label: "Account Code", required: true },
  { key: "name", label: "Account Name", required: true },
  {
    key: "type",
    label: "Type",
    type: "select",
    options: ACCOUNT_TYPES,
    optionLabel: "label",
    required: true,
  },
];

export default function AccountsPage() {
  return <MasterCrudPage title="Chart of Accounts" entity="accounts" columns={columns} fields={fields} />;
}
