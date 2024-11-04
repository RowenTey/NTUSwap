import React, {
	createContext,
	useState,
	useEffect,
	useCallback,
	useMemo,
	useContext,
	ReactNode,
} from "react";
import Web3 from "web3";

interface DEXContract {
	exchange: any | null;
	tokenManager: any | null;
	marketManager: any | null;
}

interface Web3ContextType {
	web3: Web3 | null;
	isWalletConnected: boolean;
	account: string | null;
	contract: DEXContract | null;
	networkId: string | null;
	initializeWeb3: () => Promise<void>;
}

interface Web3ProviderProps {
	children: ReactNode;
}

interface ContractJSON {
	abi: any[];
	networks: {
		[key: string]: {
			address: string;
		};
	};
}

interface InvokeResponse {
	status: string;
	message: string;
	result: any;
}

export type OrderType = "Buy" | "Sell";

export type OrderNature = "Limit" | "Market";

export const Web3Context = createContext<Web3ContextType | null>(null);

export function Web3Provider({ children }: Web3ProviderProps) {
	const [web3, setWeb3] = useState<Web3 | null>(null);
	const [contract, setContract] = useState<DEXContract | null>(null);
	const [isWalletConnected, setIsWalletConnected] = useState<boolean>(false);

	const [networkId, setNetworkId] = useState<string | null>(null);
	const [account, setAccount] = useState<string | null>(null);

	const [markets, setMarkets] = useState<string[] | null>(null);
	const [tokens, setTokens] = useState<string[] | null>(null);

	const initializeWeb3 = useCallback(async () => {
		if (!window.ethereum) {
			console.log("Please install MetaMask!");
			return;
		}

		console.log("Initializing Web3...");
		const web3Instance = new Web3(window.ethereum);
		try {
			await window.ethereum.request({ method: "eth_requestAccounts" });
			setWeb3(web3Instance);

			const accounts = await web3Instance.eth.getAccounts();
			console.log("Account:", accounts[0]);
			setAccount(accounts[0]);
			setIsWalletConnected(true);

			const retrievedNetworkId = await web3Instance.eth.net.getId();
			console.log("Network ID:", retrievedNetworkId);
			setNetworkId(retrievedNetworkId.toString());

			// Load the smart contract
			const contractData = await fetch("/src/contracts/Exchange.json");
			const contractABI: ContractJSON = await contractData.json();
			console.log("Contract ABI:", contractABI.abi);

			const contractAddress =
				contractABI.networks[retrievedNetworkId.toString()].address;
			console.log("Contract address:", contractAddress);

			const contractInstance = new web3Instance.eth.Contract(
				contractABI.abi,
				contractAddress
			);
			setContract({
				exchange: contractInstance,
				tokenManager: null,
				marketManager: null,
			});
		} catch (error) {
			console.error(
				"Failed to load web3, accounts, or contract. Check console for details."
			);
			console.error(error);
		}
	}, []);

	const issue = async (
		name: string,
		symbol: string,
		initialSupply: number
	): Promise<InvokeResponse> => {
		try {
			const result = await contract?.tokenManager.methods
				.issueToken(name, symbol, initialSupply)
				.send({ from: account });
			return {
				status: "Success",
				message: `Token issued: ${result.transactionHash}`,
				result,
			};
		} catch (error) {
			return {
				status: "Error",
				message: `Failed to issue token: ${error}`,
				result: null,
			};
		}
	};

	const withdraw = async (
		symbol: string,
		amount: number
	): Promise<InvokeResponse> => {
		try {
			const result = await contract?.exchange.methods
				.withdrawTokens(symbol, amount)
				.send({ from: account });
			return {
				status: "Success",
				message: `Withdrawal successful: ${result.transactionHash}`,
				result,
			};
		} catch (error) {
			return {
				status: "Error",
				message: `Failed to withdraw tokens: ${error}`,
				result: null,
			};
		}
	};

	const deposit = async (
		symbol: string,
		amount: number
	): Promise<InvokeResponse> => {
		try {
			const result = await contract?.exchange.methods
				.depositTokens(symbol, amount)
				.send({ from: account });
			return {
				status: "Success",
				message: `Deposit successful: ${result.transactionHash}`,
				result,
			};
		} catch (error) {
			return {
				status: "Error",
				message: `Failed to deposit tokens: ${error}`,
				result: null,
			};
		}
	};

	const fetchBalance = async (symbol: string): Promise<InvokeResponse> => {
		try {
			const balance = await contract?.tokenManager.methods
				.getUserTokenBalance(symbol)
				.call();
			return {
				status: "Success",
				message: `Balance fetched: ${balance}`,
				result: balance,
			};
		} catch (error) {
			return {
				status: "Error",
				message: `Failed to fetch balance: ${error}`,
				result: null,
			};
		}
	};

	const fetchMarkets = async (): Promise<InvokeResponse> => {
		try {
			const markets = await contract?.marketManager.methods.getMarkets().call();
			return {
				status: "Success",
				message: `Markets fetched: ${markets}`,
				result: markets,
			};
		} catch (error) {
			return {
				status: "Error",
				message: `Failed to fetch markets: ${error}`,
				result: null,
			};
		}
	};

	const createOrder = async (
		tokenId1: number,
		tokenId2: number,
		price: number,
		amount: number,
		type: OrderType,
		nature: OrderNature
	): Promise<InvokeResponse> => {
		try {
			let result;
			if (type === "Buy") {
				result = await contract?.exchange.methods
					.placeBuyOrder(tokenId1, tokenId2, price, amount, nature)
					.send({ from: account });
			} else {
				result = await contract?.exchange.methods
					.placeSellOrder(tokenId2, tokenId1, price, amount, nature)
					.send({ from: account });
			}

			return {
				status: "Success",
				message: `Order created: ${result.transactionHash}`,
				result,
			};
		} catch (error) {
			return {
				status: "Error",
				message: `Failed to create order: ${error}`,
				result: null,
			};
		}
	};

	const fetchActiveOrders = async (): Promise<InvokeResponse> => {
		// TODO:Implement this function
		try {
			const orders = await contract?.exchange.methods.getActiveOrders().call();
			return {
				status: "Success",
				message: `Orders fetched: ${orders}`,
				result: orders,
			};
		} catch (error) {
			return {
				status: "Error",
				message: `Failed to fetch orders: ${error}`,
				result: null,
			};
		}
	};

	const watchUserWithdrawals = () => {
		if (!contract?.exchange) {
			return;
		}

		contract?.exchange.events
			.WithdrawalProcessed({
				filter: { user: account },
				fromBlock: "latest",
			})
			.on("data", (event: any) => {
				console.log("User withdrawal:", {
					tokenId: event.returnValues.tokenId,
					amount: event.returnValues.amount,
					timestamp: new Date(
						event.returnValues.timestamp * 1000
					).toLocaleString(),
				});
			});
	};

	useEffect(() => {
		if (window.ethereum) {
			window.ethereum.on("accountsChanged", (accounts: any) => {
				console.log("Account changed:", accounts);

				// const accountsString = accounts as string[];
				// setAccount(accountsString[0]);
			});

			window.ethereum.on("chainChanged", () => {
				console.log("Chain changed!");
				window.location.reload();
			});
		}

		// Cleanup function
		return () => {
			if (window.ethereum) {
				window.ethereum.removeListener("accountsChanged", () => {});
				window.ethereum.removeListener("chainChanged", () => {});
			}
		};
	}, []);

	const contextValue = useMemo<Web3ContextType>(
		() => ({
			web3,
			isWalletConnected,
			account,
			contract,
			networkId,
			initializeWeb3,
		}),
		[web3, isWalletConnected, account, contract, networkId, initializeWeb3]
	);

	return (
		<Web3Context.Provider value={contextValue}>{children}</Web3Context.Provider>
	);
}

export function useWeb3(): Web3ContextType {
	const context = useContext(Web3Context);
	if (context === null) {
		throw new Error("useWeb3 must be used within a Web3Provider");
	}
	return context;
}
