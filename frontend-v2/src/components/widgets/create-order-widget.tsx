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
import { OrderNature, OrderType, useWeb3 } from "@/contexts/web3";

const CreateOrderWidget: FC = () => {
	const { toast } = useToast();
	const { activeMarket, controller } = useWeb3();
	const { createOrder } = controller;
	const [orderNature, setOrderNature] = useState<OrderNature>("Limit");
	const [orderType, setOrderType] = useState<OrderType>("Buy");
	const [price, setPrice] = useState<number | string>("");
	const [quantity, setQuantity] = useState<number | string>("");
	const [total, setTotal] = useState(0);

	const calculateTotal = (price: number, quantity: number) => {
		setTotal(price * quantity);
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

	const resetForm = () => {
		setPrice("");
		setQuantity("");
		setTotal(0);
	};

	// Handler for form submission
	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		if (!activeMarket) {
			toast({
				title: "No active market.",
				variant: "destructive",
			});
			return;
		}

		if (
			(orderNature === "Limit" && Number(price) <= 0) ||
			Number(quantity) <= 0
		) {
			toast({
				title: "Please enter a valid price and quantity.",
				variant: "destructive",
			});
			return;
		}

		const res = await createOrder(
			activeMarket.tokenSymbol1,
			activeMarket.tokenSymbol2,
			orderNature === "Limit" ? Number(price) : 0,
			Number(quantity),
			orderType,
			orderNature
		);

		if (res.result === "error") {
			toast({
				title: res.message,
				variant: "destructive",
			});
			return;
		}

		toast({
			title: "Order placed successfully.",
		});
		resetForm();
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
					defaultValue="Buy"
					onValueChange={(value) => setOrderType(value as "Buy" | "Sell")}
				>
					<ToggleGroupItem value="Buy">Buy</ToggleGroupItem>
					<ToggleGroupItem value="Sell">Sell</ToggleGroupItem>
				</ToggleGroup>
				<Select
					defaultValue="Limit"
					onValueChange={(value) => setOrderNature(value as "Market" | "Limit")}
				>
					<SelectTrigger className="w-[180px]">
						<SelectValue placeholder="Order Nature" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="Limit">Limit</SelectItem>
						<SelectItem value="Market">Market</SelectItem>
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
						disabled={orderNature === "Market"}
					/>
					<Input
						type="number"
						id="quantity"
						placeholder="Quantity"
						value={quantity}
						onChange={handleQuantityChange}
					/>
				</div>
				{total !== 0 && orderNature == "Limit" && <p>Total: {total}</p>}
				<Button variant="outline" type="submit">
					Place Order
				</Button>
			</form>
		</div>
	);
};

export default CreateOrderWidget;
