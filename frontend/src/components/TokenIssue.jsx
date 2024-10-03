import { useState } from "react";
import { useWeb3 } from "../contexts/web3";

export default function TokenIssue() {
	const [name, setName] = useState("");
	const [symbol, setSymbol] = useState("");
	const [initialSupply, setInitialSupply] = useState("");
	const [status, setStatus] = useState("");
	const { contract, account } = useWeb3();

	const handleIssue = async (e) => {
		e.preventDefault();
		setStatus("Processing...");
		try {
			const result = await contract.methods
				.issueToken(name, symbol, initialSupply)
				.send({ from: account });
			console.log(result);
			setStatus(
				`Issue successful. Transaction hash: ${result.transactionHash}`
			);
		} catch (error) {
			setStatus(`Error: ${error.message}`);
		}
	};

	return (
		<form onSubmit={handleIssue} className="space-y-4">
			<div>
				<label
					htmlFor="name"
					className="block text-sm font-medium text-gray-700"
				>
					Token Name
				</label>
				<input
					type="text"
					id="name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
					required
				/>
			</div>
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
					htmlFor="initialSupply"
					className="block text-sm font-medium text-gray-700"
				>
					Initial Supply
				</label>
				<input
					type="number"
					id="initialSupply"
					value={initialSupply}
					onChange={(e) => setInitialSupply(e.target.value)}
					className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
					required
				/>
			</div>
			<button
				type="submit"
				className="w-full bg-purple-500 text-white p-2 rounded-md hover:bg-purple-600"
			>
				Issue Token
			</button>
			{status && <p className="mt-2 text-sm text-gray-600">{status}</p>}
		</form>
	);
}
