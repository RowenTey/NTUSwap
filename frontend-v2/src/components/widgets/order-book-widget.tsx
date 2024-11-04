import { FC, useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Order, columns } from "../columns/order-book-table";
import { useWeb3 } from "@/contexts/web3";

const OrderBookWidget: FC = () => {
	const { activeMarket, controller } = useWeb3();
	const { fetchActiveOrders } = controller;
	const [data, setData] = useState<Order[]>([]);

	const buyOrders = useMemo(() => {
		return data.filter((order) => order.type === "buy");
	}, [data]);
	const sellOrders = useMemo(() => {
		return data.filter((order) => order.type === "sell");
	}, [data]);

	useEffect(() => {
		if (!activeMarket) {
			return;
		}

		const fetchData = async () => {
			const resp = await fetchActiveOrders(activeMarket);
			console.log(resp);
			setData(resp.result);
		};

		fetchData();
	}, [activeMarket]);

	return (
		<div className="w-full flex flex-col gap-4 bg-white p-4 items-center rounded-md border">
			<p className="text-2xl font-bold">Order Book</p>

			<div className="container mx-auto pb-4">
				<p className="text-center text-xl font-semibold text-green-500 mb-3">
					BID
				</p>
				<DataTable columns={columns} data={buyOrders} />
			</div>

			<div className="container mx-auto pb-4">
				<p className="text-center text-xl font-semibold text-red-500 mb-3">
					ASK
				</p>
				<DataTable columns={columns} data={sellOrders} />
			</div>
		</div>
	);
};

export default OrderBookWidget;
