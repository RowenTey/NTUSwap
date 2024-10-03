import * as Tabs from "@radix-ui/react-tabs";
import TokenDeposit from "./components/TokenDeposit";
import TokenWithdraw from "./components/TokenWithdraw";
import TokenIssue from "./components/TokenIssue";
import PlaceOrder from "./components/PlaceOrder";
import CancelOrder from "./components/CancelOrder";
import { Web3Provider, useWeb3 } from "./contexts/web3";
import PropTypes from "prop-types";

function AppContent() {
	const { account, networkId } = useWeb3();

	if (!account) {
		return <div>Please connect your MetaMask wallet.</div>;
	}

	return (
		<div className="min-h-screen bg-gray-100">
			<header className="bg-white shadow">
				<div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
					<h1 className="text-3xl font-bold text-gray-900">
						Decentralized Exchange
					</h1>
					<p className="text-sm text-gray-600">Connected Account: {account}</p>
					<p className="text-sm text-gray-600">Network ID: {networkId}</p>
				</div>
			</header>

			<main>
				<div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
					<div className="px-4 py-6 sm:px-0">
						<div className="border-4 border-dashed border-gray-200 rounded-lg h-96">
							<Tabs.Root
								className="flex flex-col h-full"
								defaultValue="deposit"
							>
								<Tabs.List className="flex border-b border-gray-200 bg-white">
									<TabsTrigger value="deposit">Deposit</TabsTrigger>
									<TabsTrigger value="withdraw">Withdraw</TabsTrigger>
									<TabsTrigger value="issue">Issue Token</TabsTrigger>
									<TabsTrigger value="placeOrder">Place Order</TabsTrigger>
									<TabsTrigger value="cancelOrder">Cancel Order</TabsTrigger>
								</Tabs.List>
								<div className="flex-grow overflow-auto p-4 bg-white">
									<Tabs.Content value="deposit">
										<TokenDeposit />
									</Tabs.Content>
									<Tabs.Content value="withdraw">
										<TokenWithdraw />
									</Tabs.Content>
									<Tabs.Content value="issue">
										<TokenIssue />
									</Tabs.Content>
									<Tabs.Content value="placeOrder">
										<PlaceOrder />
									</Tabs.Content>
									<Tabs.Content value="cancelOrder">
										<CancelOrder />
									</Tabs.Content>
								</div>
							</Tabs.Root>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}

TabsTrigger.propTypes = {
	children: PropTypes.node.isRequired,
	value: PropTypes.string.isRequired,
};

function TabsTrigger({ children, value }) {
	return (
		<Tabs.Trigger
			className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 focus:outline-none focus:text-gray-700 focus:border-gray-300"
			value={value}
		>
			{children}
		</Tabs.Trigger>
	);
}

export default function App() {
	return (
		<Web3Provider>
			<AppContent />
		</Web3Provider>
	);
}
