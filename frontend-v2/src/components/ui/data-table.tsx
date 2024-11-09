"use client";

import {
	ColumnDef,
	flexRender,
	getCoreRowModel,
	RowSelectionState,
	useReactTable,
} from "@tanstack/react-table";

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useEffect, useState } from "react";

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	onSelectionChange?: (selectedData: TData | null) => void;
}

export function DataTable<TData, TValue>({
	columns,
	data,
	onSelectionChange,
}: DataTableProps<TData, TValue>) {
	const [selectedRows, setSelectedRows] = useState<RowSelectionState>({});

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		onRowSelectionChange: setSelectedRows,
		enableMultiRowSelection: false, // disable multi select
		state: {
			rowSelection: selectedRows,
		},
	});

	useEffect(() => {
		if (!onSelectionChange) return;

		// unselected
		if (!table.getSelectedRowModel().rows.length) {
			onSelectionChange(null);
			return;
		}

		onSelectionChange(data[Number(table.getSelectedRowModel().rows[0].id)]);
	}, [selectedRows]);

	return (
		<div className="w-full rounded-md border max-h-[200px] overflow-y-auto">
			<Table>
				<TableHeader>
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id}>
							{headerGroup.headers.map((header) => {
								return (
									<TableHead key={header.id}>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext()
											  )}
									</TableHead>
								);
							})}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{table.getRowModel().rows?.length ? (
						table.getRowModel().rows.map((row) => (
							<TableRow
								key={row.id}
								data-state={row.getIsSelected() && "selected"}
							>
								{row.getVisibleCells().map((cell) => (
									<TableCell key={cell.id}>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</TableCell>
								))}
							</TableRow>
						))
					) : (
						<TableRow>
							<TableCell colSpan={columns.length} className="h-24 text-center">
								No results.
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</div>
	);
}
