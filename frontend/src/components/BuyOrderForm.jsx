import { useState } from "react";

function BuyOrderForm({ web3, contract, account }) {
	const [tokenAddress, setTokenAddress] = useState("");
	const [amount, setAmount] = useState("");
	const [price, setPrice] = useState("");

	const submitBuyOrder = async (tokenAddress, amount, price) => {
		const totalCost = web3.utils.toWei((amount * price).toString(), "ether"); // assuming price is in ETH
		await contract.methods.submitBuyOrder(tokenAddress, amount, price).send({
			from: account,
			value: totalCost,
		});
		alert("Buy order submitted!");
	};

	return (
		<div>
			<h2>Submit Buy Order</h2>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					submitBuyOrder(tokenAddress, amount, price);
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
				<button type="submit">Submit Buy Order</button>
			</form>
		</div>
	);
}

export default BuyOrderForm;
