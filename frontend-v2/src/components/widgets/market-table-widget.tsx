import { FC, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { MarketOrder, columns } from "../columns/market-table";

const MarketTableWidget: FC = () => {
	const [data, setData] = useState<MarketOrder[]>([]);

	const getData = async (): Promise<MarketOrder[]> => {
		return new Promise((resolve) => {
			resolve([
				{
					market: "NTU/NUS",
					orderType: "SELL",
					price: 2.0,
					quantity: 3.0,
				},
				{
					market: "NTU/NUS",
					orderType: "BUY",
					price: 4.0,
					quantity: 12.0,
				},
				{
					market: "NTU/NUS",
					orderType: "BUY",
					price: 6.0,
					quantity: 3.0,
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

	return (
		<div className="w-full flex flex-col gap-4 bg-zinc-300 p-4 items-center rounded-md border">
			<p className="text-2xl font-bold">Markets Overview</p>

			<Tabs
				defaultValue="open-orders"
				className="w-[600px] flex flex-col items-center"
			>
				<TabsList>
					<TabsTrigger value="open-orders">Open Orders</TabsTrigger>
					<TabsTrigger value="cancelled-orders">Cancelled Orders</TabsTrigger>
					<TabsTrigger value="trade-history">Trade History</TabsTrigger>
				</TabsList>
				<TabsContent value="open-orders">
					Make changes to your account here.
				</TabsContent>
				<TabsContent value="cancelled-orders">
					Change your password here.
				</TabsContent>
				<TabsContent value="trade-history">See your trade history.</TabsContent>
			</Tabs>

			<div className="container mx-auto pb-4">
				<DataTable columns={columns} data={data} />
			</div>
		</div>
	);
};

export default MarketTableWidget;
