import { useState } from "react";

export default function CancelOrder() {
	const [marketID, setMarketID] = useState("");
	const [orderType, setOrderType] = useState("Buy");
	const [orderId, setOrderId] = useState("");

	const handleCancelOrder = async (e) => {
		e.preventDefault();
		// TODO: Implement order cancellation logic using ethers.js
		console.log(
			`Cancelling ${orderType} order ${orderId} in market ${marketID}`
		);
	};

	return (
		<form onSubmit={handleCancelOrder} className="space-y-4">
			<div>
				<label
					htmlFor="marketID"
					className="block text-sm font-medium text-gray-700"
				>
					Market ID
				</label>
				<input
					type="number"
					id="marketID"
					value={marketID}
					onChange={(e) => setMarketID(e.target.value)}
					className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
					required
				/>
			</div>
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
					htmlFor="orderId"
					className="block text-sm font-medium text-gray-700"
				>
					Order ID
				</label>
				<input
					type="number"
					id="orderId"
					value={orderId}
					onChange={(e) => setOrderId(e.target.value)}
					className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
					required
				/>
			</div>
			<button
				type="submit"
				className="w-full bg-red-500 text-white p-2 rounded-md hover:bg-red-600"
			>
				Cancel Order
			</button>
		</form>
	);
}
