import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

export default function PlaceOrder() {
	const [symbol1, setSymbol1] = useState("");
	const [symbol2, setSymbol2] = useState("");
	const [price, setPrice] = useState("");
	const [amount, setAmount] = useState("");
	const [orderType, setOrderType] = useState("Buy");
	const [orderNature, setOrderNature] = useState("Market");
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [orderDetails, setOrderDetails] = useState(null);

	const handlePlaceOrder = async (e) => {
		e.preventDefault();
		// TODO: Implement order placement logic using ethers.js
		const details = {
			symbol1,
			symbol2,
			price,
			amount,
			orderType,
			orderNature,
		};
		setOrderDetails(details);
		setIsDialogOpen(true);
	};

	const confirmOrder = async () => {
		// TODO: Implement final order placement logic using ethers.js
		console.log("Order confirmed:", orderDetails);
		setIsDialogOpen(false);
	};

	return (
		<div>
			<form onSubmit={handlePlaceOrder} className="space-y-4">
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label
							htmlFor="symbol1"
							className="block text-sm font-medium text-gray-700"
						>
							Token 1 Symbol
						</label>
						<input
							type="text"
							id="symbol1"
							value={symbol1}
							onChange={(e) => setSymbol1(e.target.value)}
							className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
							required
						/>
					</div>
					<div>
						<label
							htmlFor="symbol2"
							className="block text-sm font-medium text-gray-700"
						>
							Token 2 Symbol
						</label>
						<input
							type="text"
							id="symbol2"
							value={symbol2}
							onChange={(e) => setSymbol2(e.target.value)}
							className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
							required
						/>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label
							htmlFor="price"
							className="block text-sm font-medium text-gray-700"
						>
							Price
						</label>
						<input
							type="number"
							id="price"
							value={price}
							onChange={(e) => setPrice(e.target.value)}
							className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
							required
						/>
					</div>
					<div>
						<label
							htmlFor="amount"
							className="block text-sm font-medium text-gray-700"
						>
							Amount
						</label>
						<input
							type="number"
							id="amount"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
							required
						/>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label
							htmlFor="orderType"
							className="block text-sm font-medium text-gray-700"
						>
							Order Type
						</label>
						<select
							id="orderType"
							value={orderType}
							onChange={(e) => setOrderType(e.target.value)}
							className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
						>
							<option value="Buy">Buy</option>
							<option value="Sell">Sell</option>
						</select>
					</div>
					<div>
						<label
							htmlFor="orderNature"
							className="block text-sm font-medium text-gray-700"
						>
							Order Nature
						</label>
						<select
							id="orderNature"
							value={orderNature}
							onChange={(e) => setOrderNature(e.target.value)}
							className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
						>
							<option value="Market">Market</option>
							<option value="Limit">Limit</option>
						</select>
					</div>
				</div>
				<button
					type="submit"
					className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600"
				>
					Place Order
				</button>
			</form>

			<Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<Dialog.Portal>
					<Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-50" />
					<Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg shadow-lg w-96">
						<Dialog.Title className="text-lg font-bold mb-4">
							Confirm Order
						</Dialog.Title>
						<Dialog.Description className="mb-4">
							Please review your order details before confirming:
						</Dialog.Description>
						{orderDetails && (
							<div className="space-y-2 mb-4">
								<p>
									Type: {orderDetails.orderType} {orderDetails.orderNature}{" "}
									Order
								</p>
								<p>
									Amount: {orderDetails.amount} {orderDetails.symbol1}
								</p>
								<p>
									Price: {orderDetails.price} {orderDetails.symbol2} per{" "}
									{orderDetails.symbol1}
								</p>
								<p>
									Total:{" "}
									{Number(orderDetails.amount) * Number(orderDetails.price)}{" "}
									{orderDetails.symbol2}
								</p>
							</div>
						)}
						<div className="flex justify-end space-x-2">
							<Dialog.Close asChild>
								<button className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
									Cancel
								</button>
							</Dialog.Close>
							<button
								onClick={confirmOrder}
								className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
							>
								Confirm
							</button>
						</div>
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog.Root>
		</div>
	);
}
