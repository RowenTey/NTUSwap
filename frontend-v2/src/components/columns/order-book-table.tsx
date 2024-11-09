"use client";

import { OrderNature, OrderType } from "@/contexts/web3";
import { ColumnDef } from "@tanstack/react-table";

export type Fill = {
	price: number;
	quantity: number;
	timestamp: number;
};

export type Order = {
	id: number;
	price: number;
	quantity: number;
	type: OrderType;
	nature: OrderNature;
	status: "active" | "filled" | "cancelled";
	market: string;
	fills: Fill[];
};

export const columns: ColumnDef<Order>[] = [
	{
		accessorKey: "price",
		header: "Price",
		cell: ({ row }) => {
			const nature = row.original.nature;
			const price = row.original.price;
			return nature === "Market" ? "-" : `$${price}`;
		},
	},
	{
		accessorKey: "quantity",
		header: "Quantity",
	},
	{
		accessorKey: "nature",
		header: "Nature",
		cell: ({ cell }) => {
			const value = cell.getValue();
			return typeof value === "string" ? value.toUpperCase() : value;
		},
	},
];
