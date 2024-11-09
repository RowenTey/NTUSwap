import { FC, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { columns } from "../columns/market-table";
import { Market, OrderStatusQueryFilters, useWeb3 } from "@/contexts/web3";
import { Order } from "../columns/order-book-table";
import { useToast } from "@/hooks/use-toast";

const MarketTableWidget: FC = () => {
	const { toast } = useToast();
	const { account, activeMarket, refetchOrders, controller } = useWeb3();
	const { fetchOrders, cancelOrder, setRefetchOrders } = controller;
	const [data, setData] = useState<Order[]>([]);
	const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
	const [activeTab, setActiveTab] = useState<
		"open-orders" | "cancelled-orders" | "trade-history"
	>("open-orders");

	const getStatus = (status: string) => {
		switch (status) {
			case "open-orders":
				return "ACTIVE";
			case "cancelled-orders":
				return "CANCELLED";
			case "trade-history":
				return "FILLED";
			default:
				return "ACTIVE";
		}
	};

	const fetchData = async (market: Market) => {
		const status = getStatus(activeTab);
		console.log(`Fetching orders for ${market} with status ${status}`);
		const resp = await fetchOrders(
			market,
			status as OrderStatusQueryFilters,
			false
		);

		if (status === "FILLED") {
			// recalculate the total quantity for filled orders
			resp.result = resp.result.map((order) => {
				const { fills } = order;
				const totalAmount = fills.reduce((acc, fill) => acc + fill.quantity, 0);
				return {
					...order,
					quantity: totalAmount,
				};
			});
		}

		setData(resp.result);
	};

	useEffect(() => {
		if (!activeMarket) return;

		fetchData(activeMarket);
	}, [account, activeMarket, activeTab]);

	useEffect(() => {
		if (!activeMarket || !refetchOrders.marketTable) return;

		fetchData(activeMarket);
		setRefetchOrders((prev) => ({ ...prev, marketTable: false }));
	}, [refetchOrders]);

	// Filter data based on the active tab
	const filteredData = data.filter((order) => {
		if (activeTab === "open-orders") return order.status === "active";
		if (activeTab === "cancelled-orders") return order.status === "cancelled";
		if (activeTab === "trade-history") return order.status === "filled";
		return false;
	});

	const handleSelectionChange = (selected: Order | null) => {
		setSelectedOrder(selected);
	};

	const handleCancelOrder = async () => {
		console.log(`Cancelling order...`, selectedOrder);
		if (!selectedOrder) return;

		const [tokenSymbol1, tokenSymbol2] = selectedOrder.market.split("/");

		const res = await cancelOrder(
			tokenSymbol1,
			tokenSymbol2,
			selectedOrder.id,
			selectedOrder.type,
			selectedOrder.nature
		);
		if (res.status === "Error") {
			toast({
				title: "Error",
				description: res.message,
				variant: "destructive",
			});
			return;
		}

		toast({
			title: "Order cancelled successfully.",
		});
		setData(data.filter((order) => order.id !== selectedOrder.id));
	};

	return (
		<div className="w-full flex flex-col gap-2 bg-zinc-300 p-4 items-center rounded-md border">
			<p className="text-xl font-bold">Overview</p>

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
						<DataTable
							columns={columns}
							data={filteredData}
							onSelectionChange={handleSelectionChange}
						/>
					</div>
				</TabsContent>
				<TabsContent className="w-full" value="cancelled-orders">
					<div className="container mx-auto pb-4">
						<DataTable
							columns={columns.filter((col) => col.id !== "select")}
							data={filteredData}
						/>
					</div>
				</TabsContent>
				<TabsContent className="w-full" value="trade-history">
					<div className="container mx-auto pb-4">
						<DataTable
							columns={columns.filter((col) => col.id !== "select")}
							data={filteredData}
						/>
					</div>
				</TabsContent>
			</Tabs>

			<Button
				disabled={activeTab !== "open-orders" || selectedOrder === null}
				onClick={handleCancelOrder}
			>
				Cancel
			</Button>
		</div>
	);
};

export default MarketTableWidget;
