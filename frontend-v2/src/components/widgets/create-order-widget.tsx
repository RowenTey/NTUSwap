import { FC } from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const CreateOrderWidget: FC = () => {
	return (
		<div className="w-full flex flex-col gap-3 bg-slate-300 p-4 items-center rounded-md border">
			<p className="text-2xl font-bold">Create Order</p>
			<form onSubmit={() => {}} className="flex flex-col gap-2 items-center">
				<ToggleGroup defaultValue="buy" type="single">
					<ToggleGroupItem value="buy">Buy</ToggleGroupItem>
					<ToggleGroupItem value="sell">Sell</ToggleGroupItem>
				</ToggleGroup>
				<Select defaultValue="market">
					<SelectTrigger className="w-[180px]">
						<SelectValue placeholder="Order Nature" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="market">Market</SelectItem>
						<SelectItem value="limit">Limit</SelectItem>
					</SelectContent>
				</Select>
				<div className="w-full flex gap-2">
					<Input type="price" id="price" placeholder="Price" />
					<Input type="quantity" id="quantity" placeholder="Quantity" />
				</div>
				<p>Total: 0</p>
				<Button variant="outline" type="submit">
					Place Order
				</Button>
			</form>
		</div>
	);
};

export default CreateOrderWidget;
