"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";

export type MarketOrder = {
	market: string;
	orderType: string;
	price: number;
	quantity: number;
};

export const columns: ColumnDef<MarketOrder>[] = [
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
		accessorKey: "orderType",
		header: "Type",
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
