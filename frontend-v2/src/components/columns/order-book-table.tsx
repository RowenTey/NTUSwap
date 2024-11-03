"use client";

import { ColumnDef } from "@tanstack/react-table";

export type Order = {
	price: number;
	quantity: number;
	total: number;
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
	},
];
