import { useState } from "react";
import { useWeb3 } from "../contexts/web3";

export default function TokenDeposit() {
	const [symbol, setSymbol] = useState("");
	const [amount, setAmount] = useState("");
	const [status, setStatus] = useState("");
	const { contract, account } = useWeb3();

	const handleDeposit = async (e) => {
		e.preventDefault();
		setStatus("Processing...");
		try {
			const result = await contract.methods
				.depositTokens(symbol, amount)
				.send({ from: account });
			setStatus(
				`Deposit successful. Transaction hash: ${result.transactionHash}`
			);
		} catch (error) {
			setStatus(`Error: ${error.message}`);
		}
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
			{status && <p className="mt-2 text-sm text-gray-600">{status}</p>}
		</form>
	);
}
