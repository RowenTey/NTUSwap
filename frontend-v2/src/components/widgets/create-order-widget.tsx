import { FC, FormEvent, useState } from "react";
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
import { useToast } from "@/hooks/use-toast";

const CreateOrderWidget: FC = () => {
	const { toast } = useToast();
	const [orderNature, setOrderNature] = useState<"market" | "limit">("market");
	const [orderType, setOrderType] = useState<"buy" | "sell">("buy");
	const [price, setPrice] = useState<number | string>("");
	const [quantity, setQuantity] = useState<number | string>("");
	const [total, setTotal] = useState(0);

	const calculateTotal = (price: number, quantity: number) => {
		setTotal(price * quantity);
	};

	// Handler for form submission
	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		if (Number(price) <= 0 || Number(quantity) <= 0) {
			toast({
				title: "Please enter a valid price and quantity.",
				variant: "destructive",
			});
			return;
		}

		const orderData = {
			orderNature,
			orderType,
			price: Number(price),
			quantity: Number(quantity),
			total,
		};

		console.log("Order submitted:", orderData);
		// Add your form submission logic here
	};

	const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setPrice(value);
		if (quantity) calculateTotal(Number(value), Number(quantity));
	};

	const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setQuantity(value);
		if (price) calculateTotal(Number(price), Number(value));
	};

	return (
		<div className="w-full flex flex-col gap-3 bg-slate-300 p-4 items-center rounded-md border">
			<p className="text-2xl font-bold">Create Order</p>
			<form
				onSubmit={handleSubmit}
				className="flex flex-col gap-2 items-center"
			>
				<ToggleGroup
					type="single"
					defaultValue="buy"
					onValueChange={(value) => setOrderType(value as "buy" | "sell")}
				>
					<ToggleGroupItem value="buy">Buy</ToggleGroupItem>
					<ToggleGroupItem value="sell">Sell</ToggleGroupItem>
				</ToggleGroup>
				<Select
					defaultValue="market"
					onValueChange={(value) => setOrderNature(value as "market" | "limit")}
				>
					<SelectTrigger className="w-[180px]">
						<SelectValue placeholder="Order Nature" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="market">Market</SelectItem>
						<SelectItem value="limit">Limit</SelectItem>
					</SelectContent>
				</Select>

				<div className="w-full flex gap-2">
					<Input
						type="number"
						id="price"
						placeholder="Price"
						value={price}
						onChange={handlePriceChange}
						// Disable price input for market orders
						disabled={orderNature === "market"}
					/>
					<Input
						type="number"
						id="quantity"
						placeholder="Quantity"
						value={quantity}
						onChange={handleQuantityChange}
					/>
				</div>
				{total !== 0 && <p>Total: {total}</p>}
				<Button variant="outline" type="submit">
					Place Order
				</Button>
			</form>
		</div>
	);
};

export default CreateOrderWidget;
