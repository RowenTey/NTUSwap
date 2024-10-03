import { useState } from "react";
import { useWeb3 } from "../contexts/web3";

export default function TokenWithdraw() {
	const [symbol, setSymbol] = useState("");
	const [amount, setAmount] = useState("");
	const [status, setStatus] = useState("");
	const { contract, account } = useWeb3();

	const handleWithdraw = async (e) => {
		e.preventDefault();
		setStatus("Processing...");
		try {
			const result = await contract.methods
				.withdrawTokens(symbol, amount)
				.send({ from: account });
			setStatus(
				`Withdrawal successful. Transaction hash: ${result.transactionHash}`
			);
		} catch (error) {
			setStatus(`Error: ${error.message}`);
		}
	};

	return (
		<form onSubmit={handleWithdraw} className="space-y-4">
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
				className="w-full bg-green-500 text-white p-2 rounded-md hover:bg-green-600"
			>
				Withdraw
			</button>
			{status && <p className="mt-2 text-sm text-gray-600">{status}</p>}
		</form>
	);
}
