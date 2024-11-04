"use client";

import { ColumnDef } from "@tanstack/react-table";

export type Order = {
	price: number;
	quantity: number;
	type: "buy" | "sell";
	nature?: "limit" | "market";
	status?: "active" | "filled" | "cancelled";
	market?: string;
};

export const columns: ColumnDef<Order>[] = [
	{
		accessorKey: "price",
		header: "Price",
	},
	{
		accessorKey: "quantity",
		header: "Quantity",
	},
	{
		accessorKey: "total",
		header: "Total",
		cell: ({ row }) => {
			const price = row.original.price;
			const quantity = row.original.quantity;
			return price * quantity;
		},
	},
];
