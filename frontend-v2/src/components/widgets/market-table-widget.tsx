import { FC, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
// import { MarketOrder, columns } from "../columns/market-table";
import { columns } from "../columns/market-table";

// TODO: remove later, just a placeholder
interface MarketOrder {
	market: string;
	orderType: "BUY" | "SELL";
	price: number;
	quantity: number;
	status: "open" | "cancelled" | "completed";
}

const MarketTableWidget: FC = () => {
	const [data, setData] = useState<MarketOrder[]>([]);
	const [activeTab, setActiveTab] = useState<
		"open-orders" | "cancelled-orders" | "trade-history"
	>("open-orders");

	// Simulated API call to fetch data
	const getData = async (): Promise<MarketOrder[]> => {
		return new Promise((resolve) => {
			resolve([
				{
					market: "NTU/NUS",
					orderType: "SELL",
					price: 2.0,
					quantity: 3.0,
					status: "open",
				},
				{
					market: "NTU/NUS",
					orderType: "BUY",
					price: 4.0,
					quantity: 12.0,
					status: "cancelled",
				},
				{
					market: "NTU/NUS",
					orderType: "BUY",
					price: 6.0,
					quantity: 3.0,
					status: "completed",
				},
			]);
		});
	};

	useEffect(() => {
		const fetchData = async () => {
			const resp = await getData();
			setData(resp);
		};

		fetchData();
	}, []);

	// Filter data based on the active tab
	const filteredData = data.filter((order) => {
		if (activeTab === "open-orders") return order.status === "open";
		if (activeTab === "cancelled-orders") return order.status === "cancelled";
		if (activeTab === "trade-history") return order.status === "completed";
		return false;
	});

	return (
		<div className="w-full flex flex-col gap-4 bg-zinc-300 p-4 items-center rounded-md border">
			<p className="text-2xl font-bold">Markets Overview</p>

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
