import { FC, useEffect, useState } from "react";
import { TokenBalance, columns } from "../columns/token-balance-table";
import { DataTable } from "../ui/data-table";

const UserBalanceWidget: FC = () => {
	const [data, setData] = useState<TokenBalance[]>([]);

	const getData = async (): Promise<TokenBalance[]> => {
		return new Promise((resolve) => {
			resolve([
				{
					token: "NTU",
					quantity: 3.0,
				},
				{
					token: "NUS",
					quantity: 12.0,
				},
				{
					token: "SMU",
					quantity: 3.0,
				},
				{
					token: "SMU",
					quantity: 3.0,
				},
				{
					token: "SMU",
					quantity: 3.0,
				},
				{
					token: "SMU",
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
		<div className="w-full flex flex-col gap-3 bg-white p-4 items-center rounded-md border">
			<p className="text-2xl font-bold">Account Balance</p>
			<DataTable columns={columns} data={data} />
		</div>
	);
};

export default UserBalanceWidget;
