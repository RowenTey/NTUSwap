import { FC, useMemo } from "react";
import { ComboBox } from "@/components/ui/combo-box";
import { InteractiveLineChart } from "@/components/ui/line-chart";
import { useWeb3 } from "@/contexts/web3";
import { LoadingSpinner } from "../ui/spinner";

const PriceHistoryWidget: FC = () => {
	const { markets, controller } = useWeb3();
	const { setActiveMarket } = controller;

	const comboBoxData = useMemo(() => {
		return markets.map((market) => {
			const { tokenSymbol1, tokenSymbol2 } = market;
			return {
				value: `${tokenSymbol1}/${tokenSymbol2}`,
				label: `${tokenSymbol1.toUpperCase()}/${tokenSymbol2.toUpperCase()}`,
			};
		});
	}, [markets]);

	if (markets.length === 0) {
		return (
			<div className="w-full flex justify-center items-center h-[40%] bg-zinc-300 p-4 rounded-md border">
				<LoadingSpinner size={36} />
			</div>
		);
	}

	const handleOnValueChanged = (value: string) => {
		console.log("Value changed: ", value);
		const [tokenSymbol1, tokenSymbol2] = value.split("/");
		setActiveMarket({ tokenSymbol1, tokenSymbol2 });
	};

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
				<p>Current Price: 10.00</p>
			</div>

			<div className="flex items-center">
				<InteractiveLineChart />
			</div>
		</div>
	);
};

export default PriceHistoryWidget;
