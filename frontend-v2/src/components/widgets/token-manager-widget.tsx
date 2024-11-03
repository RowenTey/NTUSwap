import { FC } from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";

const TokenManagerWidget: FC = () => {
	return (
		<div className="w-full flex flex-col gap-3 bg-slate-300 p-4 items-center rounded-md border">
			<p className="text-2xl font-bold">Manage Token</p>
			<form onSubmit={() => {}} className="flex flex-col gap-2 items-center">
				<ToggleGroup defaultValue="deposit" type="single">
					<ToggleGroupItem value="deposit">Deposit</ToggleGroupItem>
					<ToggleGroupItem value="withdraw">Withdraw</ToggleGroupItem>
				</ToggleGroup>
				<Select defaultValue="ntu">
					<SelectTrigger className="w-[180px]">
						<SelectValue placeholder="Select Token" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="ntu">NTU</SelectItem>
						<SelectItem value="nus">NUS</SelectItem>
					</SelectContent>
				</Select>
				<div className="grid w-full max-w-sm items-center gap-1.5">
					<Input type="quantity" id="quantity" placeholder="Quantity" />
				</div>
				<Button type="submit">Submit</Button>
			</form>
		</div>
	);
};

export default TokenManagerWidget;
