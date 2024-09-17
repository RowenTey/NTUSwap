import { useState, useEffect } from "react";

function OrdersList({ account, contract }) {
	const [buyOrders, setBuyOrders] = useState([]);
	const [sellOrders, setSellOrders] = useState([]);

	useEffect(() => {
		if (!account) {
			return;
		}

		const getOrders = async () => {
			const buyOrders = await contract.methods.getBuyOrders().call();
			const sellOrders = await contract.methods.getSellOrders().call();

			setBuyOrders(buyOrders);
			setSellOrders(sellOrders);
		};

		getOrders();
	}, [account, contract]);

	return (
		<div>
			<h2>Active Buy Orders</h2>
			<ul>
				{buyOrders.map((order, index) => (
					<li key={index}>
						{order.amount} {order.tokenAddress} @ {order.price} ETH
					</li>
				))}
			</ul>

			<h2>Active Sell Orders</h2>
			<ul>
				{sellOrders.map((order, index) => (
					<li key={index}>
						{order.amount} {order.tokenAddress} @ {order.price} ETH
					</li>
				))}
			</ul>
		</div>
	);
}

export default OrdersList;
