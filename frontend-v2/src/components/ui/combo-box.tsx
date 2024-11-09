"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

interface ComboBoxProps {
	data: { value: string; label: string }[];
	defaultValue?: string;
	onValueChanged?: (value: string) => void;
}

export function ComboBox({
	data,
	defaultValue,
	onValueChanged,
}: ComboBoxProps) {
	const [open, setOpen] = React.useState(false);
	const [value, setValue] = React.useState(defaultValue ? defaultValue : "");

	React.useEffect(() => {
		if (!onValueChanged) {
			return;
		}

		onValueChanged(value);
	}, [value]);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="w-[200px] justify-between"
				>
					{value
						? data.find((dataPoint) => dataPoint.value === value)?.label
						: defaultValue
						? data.find((dataPoint) => dataPoint.value === defaultValue)?.label
						: "Select market"}
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>

			<PopoverContent className="w-[200px] p-0">
				<Command>
					<CommandInput placeholder="Search market..." />
					<CommandList>
						<CommandEmpty>No markets found.</CommandEmpty>
						<CommandGroup>
							{data.map((dataPoint) => (
								<CommandItem
									key={dataPoint.value}
									value={dataPoint.value}
									onSelect={(currentValue) => {
										setValue(
											currentValue === value
												? defaultValue
													? defaultValue
													: ""
												: currentValue
										);
										setOpen(false);
									}}
								>
									<Check
										className={cn(
											"mr-2 h-4 w-4",
											value === dataPoint.value ? "opacity-100" : "opacity-0"
										)}
									/>
									{dataPoint.label}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
