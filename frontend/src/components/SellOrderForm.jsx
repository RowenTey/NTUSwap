import { useState } from "react";

function SellOrderForm({ contract, account }) {
	const [tokenAddress, setTokenAddress] = useState("");
	const [amount, setAmount] = useState("");
	const [price, setPrice] = useState("");

	const submitSellOrder = async (tokenAddress, amount, price) => {
		await contract.methods.submitSellOrder(tokenAddress, amount, price).send({
			from: account,
		});
		alert("Sell order submitted!");
	};

	return (
		<div>
			<h2>Submit Sell Order</h2>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					submitSellOrder(tokenAddress, amount, price);
				}}
			>
				<input
					type="text"
					placeholder="Token Address"
					value={tokenAddress}
					onChange={(e) => setTokenAddress(e.target.value)}
				/>
				<input
					type="text"
					placeholder="Amount"
					value={amount}
					onChange={(e) => setAmount(e.target.value)}
				/>
				<input
					type="text"
					placeholder="Price (ETH)"
					value={price}
					onChange={(e) => setPrice(e.target.value)}
				/>
				<button type="submit">Submit Sell Order</button>
			</form>
		</div>
	);
}

export default SellOrderForm;
