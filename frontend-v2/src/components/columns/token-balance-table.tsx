"use client";

import { ColumnDef } from "@tanstack/react-table";

export type TokenBalance = {
	token: string;
	quantity: number;
};

export const columns: ColumnDef<TokenBalance>[] = [
	{
		accessorKey: "token",
		header: "Token",
	},
	{
		accessorKey: "quantity",
		header: "Quantity",
	},
];
