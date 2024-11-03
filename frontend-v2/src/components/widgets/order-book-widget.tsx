import { FC, useEffect, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Order, columns } from "../columns/order-book-table";

const OrderBookWidget: FC = () => {
	const [data, setData] = useState<Order[]>([]);

	const getData = async (): Promise<Order[]> => {
		return new Promise((resolve) => {
			resolve([
				{
					price: 2.0,
					quantity: 3.0,
					total: 2.0 * 3.0,
				},
				{
					price: 4.0,
					quantity: 12.0,
					total: 4.0 * 12.0,
				},
				{
					price: 6.0,
					quantity: 3.0,
					total: 6.0 * 3.0,
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
		<div className="w-full flex flex-col gap-4 bg-white p-4 items-center rounded-md border">
			<p className="text-2xl font-bold">Order Book</p>

			<div className="container mx-auto pb-4">
				<p className="text-center text-xl font-semibold text-green-500 mb-3">
					BID
				</p>
				<DataTable columns={columns} data={data} />
			</div>

			<div className="container mx-auto pb-4">
				<p className="text-center text-xl font-semibold text-red-500 mb-3">
					ASK
				</p>
				<DataTable columns={columns} data={data} />
			</div>
		</div>
	);
};

export default OrderBookWidget;
