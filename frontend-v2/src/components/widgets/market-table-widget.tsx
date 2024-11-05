import { FC, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { columns } from "../columns/market-table";
import { useWeb3 } from "@/contexts/web3";
import { Order } from "../columns/order-book-table";

const MarketTableWidget: FC = () => {
	const { activeMarket, controller } = useWeb3();
	const { fetchActiveOrders } = controller;
	const [data, setData] = useState<Order[]>([]);
	const [activeTab, setActiveTab] = useState<
		"open-orders" | "cancelled-orders" | "trade-history"
	>("open-orders");

	const getData = async (): Promise<Order[]> => {
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve([
					{
						market: "ETH/USDT",
						type: "buy",
						price: 3,
						quantity: 1,
						status: "active",
						nature: "limit",
					},
					{
						market: "ETH/USDT",
						type: "sell",
						price: -1,
						quantity: 1,
						status: "filled",
						nature: "market",
					},
					{
						market: "ETH/USDT",
						type: "buy",
						price: 4,
						quantity: 1,
						status: "cancelled",
						nature: "limit",
					},
				]);
			}, 1000);
		});
	};

	useEffect(() => {
		if (!activeMarket) return;

		const fetchData = async () => {
			// const resp = await fetchActiveOrders(activeMarket, true);
			// console.log("Fetched all active orders: ", resp);
			// setData(resp.result);
			const resp = await getData();
			setData(resp);
		};

		fetchData();
	}, [activeMarket, activeTab]);

	// Filter data based on the active tab
	const filteredData = data.filter((order) => {
		if (activeTab === "open-orders") return order.status === "active";
		if (activeTab === "cancelled-orders") return order.status === "cancelled";
		if (activeTab === "trade-history") return order.status === "filled";
		return false;
	});

	return (
		<div className="w-full flex flex-col gap-2 bg-zinc-300 p-4 items-center rounded-md border">
			<p className="text-2xl font-bold">Market Overview</p>

			<Tabs
				defaultValue="open-orders"
				className="w-full flex flex-col items-center"
				onValueChange={(value) =>
					setActiveTab(
						value as "open-orders" | "cancelled-orders" | "trade-history"
					)
				}
			>
				<TabsList>
					<TabsTrigger value="open-orders">Open Orders</TabsTrigger>
					<TabsTrigger value="cancelled-orders">Cancelled Orders</TabsTrigger>
					<TabsTrigger value="trade-history">Trade History</TabsTrigger>
				</TabsList>
				<TabsContent className="w-full" value="open-orders">
					<div className="container mx-auto pb-4">
						<DataTable columns={columns} data={filteredData} />
					</div>
				</TabsContent>
				<TabsContent className="w-full" value="cancelled-orders">
					<div className="container mx-auto pb-4">
						<DataTable columns={columns} data={filteredData} />
					</div>
				</TabsContent>
				<TabsContent className="w-full" value="trade-history">
					<div className="container mx-auto pb-4">
						<DataTable columns={columns} data={filteredData} />
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
};

export default MarketTableWidget;
