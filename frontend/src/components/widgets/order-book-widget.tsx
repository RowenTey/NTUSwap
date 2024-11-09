import { FC, useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Order, columns } from "../columns/order-book-table";
import { Market, useWeb3 } from "@/contexts/web3";

const OrderBookWidget: FC = () => {
	const { account, activeMarket, refetchOrders, controller } = useWeb3();
	const { fetchOrders, setRefetchOrders } = controller;
	const [data, setData] = useState<Order[]>([]);

	const buyOrders = useMemo(() => {
		return data.filter((order) => order.type === "Buy");
	}, [data]);
	const sellOrders = useMemo(() => {
		return data.filter((order) => order.type === "Sell");
	}, [data]);

	const fetchData = async (market: Market) => {
		const resp = await fetchOrders(market, "ACTIVE", true);
		console.log("OrderBookWidget fetchData", resp);
		setData(resp.result);
	};

	useEffect(() => {
		if (!activeMarket) {
			return;
		}

		fetchData(activeMarket);
	}, [account, activeMarket]);

	useEffect(() => {
		if (!activeMarket || !refetchOrders.orderBookTable) return;

		fetchData(activeMarket);
		setRefetchOrders((prevState) => ({
			...prevState,
			orderBookTable: false,
		}));
	}, [refetchOrders]);

	return (
		<div className="w-full flex flex-col gap-2 bg-zinc-300 p-4 items-center rounded-md border">
			<p className="text-xl font-bold">Order Book</p>

			<div className="container mx-auto pb-2">
				<p className="text-center text-xl font-semibold text-green-500 mb-2">
					BID
				</p>
				<DataTable columns={columns} data={buyOrders} />
			</div>

			<div className="container mx-auto pb-2">
				<p className="text-center text-xl font-semibold text-red-500 mb-2">
					ASK
				</p>
				<DataTable columns={columns} data={sellOrders} />
			</div>
		</div>
	);
};

export default OrderBookWidget;
