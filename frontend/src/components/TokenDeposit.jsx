import { useState } from "react";

export default function TokenDeposit() {
	const [symbol, setSymbol] = useState("");
	const [amount, setAmount] = useState("");

	const handleDeposit = async (e) => {
		e.preventDefault();
		// TODO: Implement deposit logic using ethers.js
		console.log(`Depositing ${amount} of ${symbol}`);
	};

	return (
		<form onSubmit={handleDeposit} className="space-y-4">
			<div>
				<label
					htmlFor="symbol"
					className="block text-sm font-medium text-gray-700"
				>
					Token Symbol
				</label>
				<input
					type="text"
					id="symbol"
					value={symbol}
					onChange={(e) => setSymbol(e.target.value)}
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
			<button
				type="submit"
				className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600"
			>
				Deposit
			</button>
		</form>
	);
}
