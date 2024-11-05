"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Order } from "./order-book-table";

import { Copy } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
			return nature === "market" ? "-" : price;
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
		header: "Details",
		cell: ({ row }) => (
			<Dialog>
				<DialogTrigger asChild>
					<Button variant="outline">See More</Button>
				</DialogTrigger>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Share link</DialogTitle>
						<DialogDescription>
							Anyone who has this link will be able to view this.
						</DialogDescription>
					</DialogHeader>
					<div className="flex items-center space-x-2">
						<div className="grid flex-1 gap-2">
							<Label htmlFor="link" className="sr-only">
								Link
							</Label>
							<Input
								id="link"
								defaultValue="https://ui.shadcn.com/docs/installation"
								readOnly
							/>
						</div>
						<Button type="submit" size="sm" className="px-3">
							<span className="sr-only">Copy</span>
							<Copy className="h-4 w-4" />
						</Button>
					</div>
					<DialogFooter className="sm:justify-start">
						<DialogClose asChild>
							<Button type="button" variant="secondary">
								Close
							</Button>
						</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		),
	},
];
