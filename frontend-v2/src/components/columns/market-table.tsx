"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Fill, Order } from "./order-book-table";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { DataTable } from "../ui/data-table";

const fillsColumns: ColumnDef<Fill>[] = [
	{
		accessorKey: "price",
		header: "Price",
		cell: ({ row }) => {
			const price = row.original.price;
			return `$${price}`;
		},
	},
	{
		accessorKey: "quantity",
		header: "Quantity",
	},
	{
		accessorKey: "timestamp",
		header: "Timestamp",
		// parse timestamp to human readable format
		cell: ({ row }) => {
			const timestamp = row.original.timestamp;
			return new Date(timestamp * 1000).toLocaleString();
		},
	},
];

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
				onCheckedChange={row.getToggleSelectedHandler()}
				aria-label="Select row"
			/>
		),
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
	{
		accessorKey: "fills",
		header: "Fills",
		cell: ({ row }) => {
			const fills = row.original.fills;

			return (
				<Dialog>
					<DialogTrigger asChild>
						<Button disabled={fills.length === 0}>See More</Button>
					</DialogTrigger>

					<DialogContent className="sm:max-w-md">
						<DialogHeader>
							<DialogTitle>Order Fills</DialogTitle>
							<DialogDescription>
								Partial fills of the order are shown here.
							</DialogDescription>
						</DialogHeader>
						<DataTable columns={fillsColumns} data={fills} />
						<DialogFooter className="sm:justify-center">
							<DialogClose asChild>
								<Button type="button">Close</Button>
							</DialogClose>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			);
		},
	},
];
