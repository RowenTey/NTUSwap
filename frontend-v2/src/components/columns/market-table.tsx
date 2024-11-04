"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Order } from "./order-book-table";

export const columns: ColumnDef<Order>[] = [
	{
		id: "select",
		// header: ({ table }) => (
		// 	<Checkbox
		// 		checked={
		// 			table.getIsAllPageRowsSelected() ||
		// 			(table.getIsSomePageRowsSelected() && "indeterminate")
		// 		}
		// 		onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
		// 		aria-label="Select all"
		// 	/>
		// ),
		cell: ({ row }) => (
			<Checkbox
				checked={row.getIsSelected()}
				onCheckedChange={(value) => row.toggleSelected(!!value)}
				aria-label="Select row"
			/>
		),
	},
	{
		accessorKey: "market",
		header: "Market",
	},
	{
		accessorKey: "type",
		header: "Type",
		cell: ({ cell }) => {
			const value = cell.getValue();
			return typeof value === "string" ? value.toUpperCase() : value;
		},
	},
	{
		accessorKey: "price",
		header: "Price",
	},
	{
		accessorKey: "quantity",
		header: "Quantity",
	},
];
