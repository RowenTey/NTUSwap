import { FC } from "react";
import { ComboBox } from "@/components/ui/combo-box";
import { InteractiveLineChart } from "@/components/ui/line-chart";

const markets = [
	{
		value: "ntu/nus",
		label: "NTU/NUS",
	},
	{
		value: "nus/smu",
		label: "NUS/SMU",
	},
	{
		value: "ntu/smu",
		label: "NTU/SMU",
	},
];

const PriceHistoryWidget: FC = () => {
	return (
		<div className="w-full flex flex-col gap-4 bg-white p-4 rounded-md border">
			<div className="flex justify-between items-center px-3 text-xl font-semibold">
				<div className="flex gap-3 items-center">
					<p>Market:</p>
					<ComboBox data={markets} defaultValue={markets[0].value} />
				</div>
				<p>Current Price: 10.00</p>
			</div>

			<div className="flex flex-col gap-2 items-center">
				<p className="text-2xl font-bold">Token Price History</p>
				<InteractiveLineChart />
			</div>
		</div>
	);
};

export default PriceHistoryWidget;
