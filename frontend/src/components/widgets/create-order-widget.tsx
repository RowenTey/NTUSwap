import { FC, FormEvent, useEffect, useState } from "react";
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
	const { createOrder, setRefetchOrders } = controller;
	const [orderNature, setOrderNature] = useState<OrderNature>("Limit");
	const [orderType, setOrderType] = useState<OrderType>("Buy");
	const [price, setPrice] = useState<number | string>("");
	const [quantity, setQuantity] = useState<number | string>("");
	const [total, setTotal] = useState(0);
	const [selectedToken, setSelectedToken] = useState<string>("");

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

		console.log("Selected token: ", selectedToken);
		const res = await createOrder(
			selectedToken,
			activeMarket,
			orderNature === "Limit" ? Number(price) : 0,
			Number(quantity),
			orderType,
			orderNature
		);

		if (res.status === "Error") {
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
		setRefetchOrders({
			marketTable: true,
			orderBookTable: true,
		});
	};

	useEffect(() => {
		if (!activeMarket) return;

		setSelectedToken(activeMarket.tokenSymbol1);
	}, [activeMarket]);

	return (
		<div className="w-full flex flex-col gap-3 bg-zinc-300 p-4 items-center rounded-md border">
			<p className="text-xl font-bold">Create Order</p>
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
				{activeMarket && (
					<Select
						defaultValue={activeMarket.tokenSymbol1}
						onValueChange={(value) => {
							console.log("Selected token: ", value);
							setSelectedToken(value);
						}}
					>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="Token" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={activeMarket.tokenSymbol1}>
								{activeMarket.tokenSymbol1}
							</SelectItem>
							<SelectItem value={activeMarket.tokenSymbol2}>
								{activeMarket.tokenSymbol2}
							</SelectItem>
						</SelectContent>
					</Select>
				)}
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
						className="border-zinc-700"
						onChange={handlePriceChange}
						// Disable price input for market orders
						disabled={orderNature === "Market"}
					/>
					<Input
						type="number"
						id="quantity"
						placeholder="Quantity"
						value={quantity}
						className="border-zinc-700"
						onChange={handleQuantityChange}
					/>
				</div>
				{total !== 0 && orderNature == "Limit" && <p>Total: {total}</p>}
				<Button type="submit">Place Order</Button>
			</form>
		</div>
	);
};

export default CreateOrderWidget;
