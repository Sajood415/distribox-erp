export const lifecycleStatusColumn = {
  accessorKey: "lifecycleStatus",
  header: "Lifecycle",
  cell: ({ row }) => row.original.lifecycleStatus || "Draft",
};
