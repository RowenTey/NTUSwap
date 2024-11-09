"use client";
import { FC, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWeb3 } from "@/contexts/web3";
import PriceHistoryWidget from "@/components/widgets/price-history-widget";
import MarketTableWidget from "@/components/widgets/market-table-widget";
import OrderBookWidget from "@/components/widgets/order-book-widget";
import CreateOrderWidget from "@/components/widgets/create-order-widget";
import UserBalanceWidget from "@/components/widgets/user-balance-widget";
import TokenManagerWidget from "@/components/widgets/token-manager-widget";
import { useToast } from "@/hooks/use-toast";
import { formatAddress } from "@/lib/utils";

const Dashboard: FC = () => {
	const { toast } = useToast();
	const router = useRouter();
	const { isWalletConnected, matched, controller } = useWeb3();
	const { setMatched } = controller;

	useEffect(() => {
		if (!isWalletConnected) {
			router.push("/");
			return;
		}
	}, []);

	useEffect(() => {
		if (!matched) {
			return;
		}

		toast({
			title: "Order matched!",
			description:
				"An order has been matched and settled. Tx hash: " +
				formatAddress(matched),
		});
		setMatched("");
	}, [matched]);

	return (
		<div className="py-4 px-3 grid grid-cols-4 gap-x-3">
			<div className="space-y-3">
				<UserBalanceWidget />
				<CreateOrderWidget />
				<TokenManagerWidget />
			</div>

			<div className="col-span-2 space-y-3">
				<PriceHistoryWidget />
				<MarketTableWidget />
			</div>

			<div className="">
				<OrderBookWidget />
			</div>
		</div>
	);
};

export default Dashboard;
