"use client";
import { FC } from "react";
import PriceHistoryWidget from "@/components/widgets/price-history-widget";
import MarketTableWidget from "@/components/widgets/market-table-widget";
import OrderBookWidget from "@/components/widgets/order-book-widget";
import CreateOrderWidget from "@/components/widgets/create-order-widget";
import UserBalanceWidget from "@/components/widgets/user-balance-widget";
import TokenManagerWidget from "@/components/widgets/token-manager-widget";

const DashboardPage: FC = () => {
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

export default DashboardPage;
