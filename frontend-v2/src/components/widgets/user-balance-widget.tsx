import { FC, useMemo } from "react";
import { TokenBalance, columns } from "../columns/token-balance-table";
import { DataTable } from "../ui/data-table";
import { useWeb3 } from "@/contexts/web3";
import { LoadingSpinner } from "../ui/spinner";

const UserBalanceWidget: FC = () => {
	const { balance } = useWeb3();

	const tableData: TokenBalance[] = useMemo(() => {
		return Array.from(balance.entries()).map(([token, quantity]) => {
			return {
				token,
				quantity,
			};
		});
	}, [balance]);

	if (balance.size === 0) {
		return (
			<div className="w-full flex justify-center items-center h-[20%] bg-white p-4 rounded-md border">
				<LoadingSpinner size={36} />
			</div>
		);
	}

	return (
		<div className="w-full flex flex-col gap-1 bg-white p-4 items-center rounded-md border">
			<p className="text-xl font-bold">Account Balance</p>
			<DataTable columns={columns} data={tableData} />
		</div>
	);
};

export default UserBalanceWidget;
