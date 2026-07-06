import MasterCrudPage from "../../components/MasterCrudPage";

const productColumns = [
  { accessorKey: "code", header: "Code" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "brand", header: "Brand" },
  {
    accessorKey: "baseUnit",
    header: "Unit",
    cell: ({ row }) => row.original.baseUnit?.code ?? "-",
  },
  { accessorKey: "price1", header: "Price 1" },
  { accessorKey: "costPrice", header: "Cost" },
  {
    accessorKey: "active",
    header: "Active",
    cell: ({ row }) => (row.original.active ? "Yes" : "No"),
  },
];

const productFields = [
  { key: "code", label: "Product Code", required: true },
  { key: "name", label: "Product Name", required: true },
  { key: "brand", label: "Brand" },
  { key: "category", label: "Category" },
  { key: "baseUnitId", label: "Base Unit", type: "select", optionsKey: "units", optionLabel: "name", required: true },
  { key: "packSize", label: "Pack Size", type: "number" },
  { key: "price1", label: "Price 1", type: "number" },
  { key: "price2", label: "Price 2", type: "number" },
  { key: "price3", label: "Price 3", type: "number" },
  { key: "costPrice", label: "Cost Price", type: "number" },
  { key: "vatPercent", label: "VAT %", type: "number" },
  { key: "reorderLevel", label: "Reorder Level", type: "number" },
  { key: "barCode", label: "Barcode" },
  { key: "haltOnExpiry", label: "Halt on Expiry", type: "checkbox" },
  { key: "active", label: "Active", type: "checkbox" },
];

export default function ProductsPage() {
  return (
    <MasterCrudPage
      title="Products"
      entity="products"
      columns={productColumns}
      fields={productFields}
      getDefaultRow={() => ({ active: true, haltOnExpiry: false, packSize: 1, vatPercent: 0 })}
    />
  );
}
