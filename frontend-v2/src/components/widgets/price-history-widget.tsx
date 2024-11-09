import { FC, useEffect, useMemo, useState } from "react";
import { ComboBox } from "@/components/ui/combo-box";
import { InteractiveLineChart, MarketData } from "@/components/ui/line-chart";
import { Market, useWeb3 } from "@/contexts/web3";
import { LoadingSpinner } from "../ui/spinner";
import Web3 from "web3";

const PriceHistoryWidget: FC = () => {
	const { contract, account, markets, activeMarket, controller } = useWeb3();
	const { setActiveMarket, getMarketPrice } = controller;
	const [marketData, setMarketData] = useState<MarketData[]>([]);
	const [buyMarketPrice, setBuyMarketPrice] = useState<number>(0);
	const [sellMarketPrice, setSellMarketPrice] = useState<number>(0);
	const uniqueEventIds = new Set<string>();

	const comboBoxData = useMemo(() => {
		return markets.map((market) => {
			const { tokenSymbol1, tokenSymbol2 } = market;
			return {
				value: `${tokenSymbol1}/${tokenSymbol2}`,
				label: `${tokenSymbol1.toUpperCase()}/${tokenSymbol2.toUpperCase()}`,
			};
		});
	}, [markets]);

	const handleOnValueChanged = (value: string) => {
		console.log("Value changed: ", value);
		const [tokenSymbol1, tokenSymbol2] = value.split("/");

		const market = markets.find(
			(market) =>
				market.tokenSymbol1 === tokenSymbol1 &&
				market.tokenSymbol2 === tokenSymbol2
		);
		if (!market) {
			console.error("Market not found!");
			return;
		}

		setActiveMarket(market);
	};

	const fetchMarketPrice = async (market: Market) => {
		const res = await getMarketPrice(market);
		console.log("[PriceHistoryWidget] Market price: ", res);
		setBuyMarketPrice(res.result[0]);
		setSellMarketPrice(res.result[1]);
	};

	useEffect(() => {
		if (!contract || !activeMarket) return;

		fetchMarketPrice(activeMarket);

		contract.exchange.getPastEvents(
			"OrderMatched",
			{
				fromBlock: 0,
				toBlock: "latest",
			},
			(_error: any, events: any) => {
				console.log("[PriceHistoryWidget] OrderMatched past event:", events);
			}
		);

		console.log(
			"[PriceHistoryWidget] Listening for OrderMatched with market id: ",
			activeMarket.id
		);
		const subscription = contract.exchange.events.OrderMatched({
			fromBlock: 0,
			toBlock: "latest",
		});

		subscription.on("data", (event: any) => {
			if (event.returnValues.marketId !== activeMarket.id) return;

			if (uniqueEventIds.has(event.transactionHash)) return;
			uniqueEventIds.add(event.transactionHash);

			console.log("[PriceHistoryWidget] OrderMatched event:", event);
			const { matchedAmount, executionPrice, timestamp } = event.returnValues;
			const marketData: MarketData = {
				price: Number(executionPrice),
				quantity: Number(Web3.utils.fromWei(matchedAmount, "ether")),
				timestamp: Number(timestamp),
			};
			console.log("[PriceHistoryWidget] Market data:", marketData);
			setMarketData((prev) => [...prev, marketData]);
		});

		// Cleanup function to unsubscribe from the event
		return () => {
			subscription.unsubscribe((error: any, success: any) => {
				if (success) {
					console.log("Successfully unsubscribed!");
				} else {
					console.error("Error unsubscribing:", error);
				}
			});
		};
	}, [contract, account, activeMarket]);

	if (markets.length === 0) {
		return (
			<div className="w-full flex justify-center items-center h-[40%] bg-zinc-300 p-4 rounded-md border">
				<LoadingSpinner size={36} />
			</div>
		);
	}

	return (
		<div className="w-full flex flex-col gap-2 bg-zinc-300 p-4 rounded-md border">
			<div className="flex justify-between items-center px-3 text-lg font-semibold">
				<div className="flex gap-3 items-center">
					<p>Market:</p>
					<ComboBox
						data={comboBoxData}
						defaultValue={comboBoxData[0].value}
						onValueChanged={handleOnValueChanged}
					/>
				</div>
				<p>BUY: {buyMarketPrice}</p>
				<p>SELL: {sellMarketPrice}</p>
			</div>

			<div className="flex items-center">
				<InteractiveLineChart data={marketData} />
			</div>
		</div>
	);
};

export default PriceHistoryWidget;
