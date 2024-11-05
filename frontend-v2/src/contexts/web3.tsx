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
import { toCamelCase } from "@/lib/utils";
import { Order } from "@/components/columns/order-book-table";

interface DEXContract {
	exchange: any | null;
	tokenManager: any | null;
	marketManager: any | null;
	orderBookManager: any | null;
}

interface DEXController {
	connectWallet: () => Promise<void>;
	fetchBalance: (
		tokenMap: Map<string, string>
	) => Promise<InvokeResponse<Map<string, number>>>;
	updateBalance: (symbol: string, amount: number) => void;
	deposit: (symbol: string, amount: number) => Promise<InvokeResponse<any>>;
	withdraw: (symbol: string, amount: number) => Promise<InvokeResponse<any>>;
	createOrder: (
		tokenSymbol1: string,
		tokenSymbol2: string,
		price: number,
		amount: number,
		type: OrderType,
		nature: OrderNature
	) => Promise<InvokeResponse<any>>;
	setActiveMarket: React.Dispatch<React.SetStateAction<Market | null>>;
	fetchActiveOrders: (
		market: Market,
		all?: boolean
	) => Promise<InvokeResponse<Order[]>>;
}

interface Web3ContextType {
	web3: Web3 | null;
	isWalletConnected: boolean;
	account: string | null;
	contract: DEXContract | null;
	networkId: string | null;
	balance: Map<string, number>;
	tokens: Map<string, string>;
	activeMarket: Market | null;
	markets: Market[];
	controller: DEXController;
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

interface InvokeResponse<T> {
	status: string;
	message: string;
	result: T;
}

export type Token = Map<string, string>;

interface Market {
	tokenSymbol1: string;
	tokenSymbol2: string;
}

export type OrderType = "Buy" | "Sell";

export type OrderNature = "Limit" | "Market";

export const Web3Context = createContext<Web3ContextType | null>(null);

const CONTRACTS = [
	"Exchange",
	"TokenManager",
	"MarketManager",
	"OrderBookManager",
];

async function initialiseContracts(
	web3Instance: Web3,
	networkId: string
): Promise<DEXContract> {
	const contracts: DEXContract = {
		exchange: null,
		tokenManager: null,
		marketManager: null,
		orderBookManager: null,
	};

	for (const contract of CONTRACTS) {
		// Load the smart contract
		const contractData = await fetch(`/contracts/${contract}.json`);
		const contractABI: ContractJSON = await contractData.json();
		console.log("Contract ABI:", contractABI.abi);

		const contractAddress = contractABI.networks[networkId].address;
		console.log("Contract address:", contractAddress);

		const contractInstance = new web3Instance.eth.Contract(
			contractABI.abi,
			contractAddress
		);
		contracts[toCamelCase(contract) as keyof DEXContract] = contractInstance;
	}

	return contracts;
}

export function Web3Provider({ children }: Web3ProviderProps) {
	const [web3, setWeb3] = useState<Web3 | null>(null);
	const [contract, setContract] = useState<DEXContract | null>(null);
	const [isWalletConnected, setIsWalletConnected] = useState<boolean>(false);

	const [networkId, setNetworkId] = useState<string>("");
	const [account, setAccount] = useState<string>("");

	const [markets, setMarkets] = useState<Market[]>([]);
	const [tokens, setTokens] = useState<Token>(new Map());

	const [balance, setBalance] = useState<Map<string, number>>(new Map());
	const [activeMarket, setActiveMarket] = useState<Market | null>(null);

	const connectWallet = useCallback(async () => {
		if (!window.ethereum) {
			console.log("Please install MetaMask!");
			return;
		}

		const initialized = isWalletConnected && account && web3 && contract;
		if (initialized) {
			console.log("Web3 already initialized!");
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
			const contract = await initialiseContracts(
				web3Instance,
				retrievedNetworkId.toString()
			);
			console.log("Initialized contract:", contract);
			setContract(contract);
		} catch (error) {
			console.error(
				"Failed to load web3, accounts, or contract. Check console for details."
			);
			console.error(error);
		}
	}, []);

	async function initializeTokenContract(
		web3Instance: Web3,
		tokenAddress: string
	) {
		const erc20Abi = await fetch("/contracts/Token.json").then((response) =>
			response.json()
		);
		return new web3Instance.eth.Contract(erc20Abi.abi, tokenAddress);
	}

	// Check if the contract is initialized (type guard)
	const isContractInitialized = (
		contract: DEXContract | null
	): contract is DEXContract => {
		return contract !== null;
	};

	const issue = async (
		name: string,
		symbol: string,
		initialSupply: number
	): Promise<InvokeResponse<any>> => {
		if (!isContractInitialized(contract)) {
			return {
				status: "Error",
				message: "Contract not initialized",
				result: null,
			};
		}

		try {
			const result = await contract.tokenManager.methods
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
	): Promise<InvokeResponse<any>> => {
		if (!isContractInitialized(contract)) {
			return {
				status: "Error",
				message: "Contract not initialized",
				result: null,
			};
		}

		let tokenId;
		try {
			const res = await contract.tokenManager.methods.getTokenId(symbol).call();
			tokenId = Number(res);
		} catch (error) {
			console.error(`Failed to get token ID: ${error}`);
			return {
				status: "Error",
				message: `Failed to get token ID: ${error}`,
				result: null,
			};
		}

		let tokenAddr;
		try {
			tokenAddr = await contract.tokenManager.methods.getToken(tokenId).call();
		} catch (error) {
			console.error(`Failed to get token address: ${error}`);
			return {
				status: "Error",
				message: `Failed to get token address: ${error}`,
				result: null,
			};
		}

		try {
			const tokenContract = await initializeTokenContract(
				web3 as Web3,
				tokenAddr
			);

			await tokenContract.methods
				.approve(contract.tokenManager._address, amount)
				.send({ from: account });
		} catch (error) {
			console.error(`Failed to approve token spending: ${error}`);
			return {
				status: "Error",
				message: `Failed to approve token spending: ${error}`,
				result: null,
			};
		}

		try {
			const result = await contract.tokenManager.methods
				.withdraw(symbol, amount)
				.send({ from: account });
			console.log("Withdrawal result:", result);

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
	): Promise<InvokeResponse<any>> => {
		if (!isContractInitialized(contract)) {
			return {
				status: "Error",
				message: "Contract not initialized",
				result: null,
			};
		}

		let tokenId;
		try {
			const res = await contract.tokenManager.methods.getTokenId(symbol).call();
			tokenId = Number(res);
		} catch (error) {
			console.error(`Failed to get token ID: ${error}`);
			return {
				status: "Error",
				message: `Failed to get token ID: ${error}`,
				result: null,
			};
		}

		let tokenAddr;
		try {
			tokenAddr = await contract.tokenManager.methods.getToken(tokenId).call();
		} catch (error) {
			console.error(`Failed to get token address: ${error}`);
			return {
				status: "Error",
				message: `Failed to get token address: ${error}`,
				result: null,
			};
		}

		try {
			const tokenContract = await initializeTokenContract(
				web3 as Web3,
				tokenAddr
			);

			const balance = await tokenContract.methods.balanceOf(account).call();
			console.log("Token balance:", balance);

			await tokenContract.methods
				.approve(contract.tokenManager._address, amount)
				.send({ from: account });
		} catch (error) {
			console.error(`Failed to approve token spending: ${error}`);
			return {
				status: "Error",
				message: `Failed to approve token spending: ${error}`,
				result: null,
			};
		}

		try {
			const result = await contract.tokenManager.methods
				.deposit(symbol, amount)
				.send({ from: account });
			console.log("Deposit result:", result);

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

	const updateBalance = async (symbol: string, amount: number) => {
		const tmpBalance = new Map(balance);
		tmpBalance.set(symbol, (tmpBalance.get(symbol) || 0) + amount);
		setBalance(tmpBalance);
	};

	const fetchBalance = async (
		tokenMap: Map<string, string>
	): Promise<InvokeResponse<Map<string, number>>> => {
		if (!isContractInitialized(contract)) {
			return {
				status: "Error",
				message: "Contract not initialized",
				result: new Map(),
			};
		}

		try {
			console.log("Fetching balance for account: ", account);
			const fetchedBalance = await contract.exchange.methods
				.getAllUserTokenBalance(account)
				.call();

			const balanceMap = new Map<string, number>();
			for (let i = 0; i < fetchedBalance[0].length; i++) {
				const tokenName = fetchedBalance[1][i];
				const tokenSymbol = tokenMap.get(tokenName);
				if (!tokenSymbol) {
					console.error(`Token not found: ${tokenName}`);
					continue;
				}

				const tokenBalance = Number(fetchedBalance[0][i]);
				balanceMap.set(tokenSymbol, tokenBalance);
			}
			setBalance(balanceMap);

			console.log("Balance map:", balanceMap);
			return {
				status: "Success",
				message: `Balance fetched: ${Array.from(balanceMap.entries())}`,
				result: balanceMap,
			};
		} catch (error) {
			return {
				status: "Error",
				message: `Failed to fetch balance: ${error}`,
				result: new Map(),
			};
		}
	};

	const fetchTokens = async (): Promise<
		InvokeResponse<Map<string, string>>
	> => {
		if (!isContractInitialized(contract)) {
			return {
				status: "Error",
				message: "Contract not initialized",
				result: new Map(),
			};
		}

		if (tokens.size > 0) {
			return {
				status: "Success",
				message: "Tokens already fetched",
				result: tokens,
			};
		}

		try {
			console.log("Fetching tokens...");
			const fetchedTokens = await contract.exchange.methods
				.getAllAvailableTokens()
				.call();

			console.log("Fetched tokens:", fetchedTokens);
			const tokenMap = new Map<string, string>();
			for (let i = 0; i < fetchedTokens[0].length; i++) {
				if (fetchedTokens[0][i] === "") {
					continue;
				}

				tokenMap.set(fetchedTokens[0][i], fetchedTokens[1][i]);
			}
			console.log("Token map:", tokenMap);
			setTokens(tokenMap);

			return {
				status: "Success",
				message: "Tokens fetched!",
				result: tokenMap,
			};
		} catch (error) {
			return {
				status: "Error",
				message: `Failed to fetch tokens: ${error}`,
				result: new Map(),
			};
		}
	};

	const constructMarkets = (
		tokenMap: Map<string, string>
	): InvokeResponse<Market[]> => {
		if (tokenMap.size === 0) {
			return {
				status: "Error",
				message: "Tokens not fetched",
				result: [],
			};
		}

		if (markets.length > 0) {
			return {
				status: "Success",
				message: "Markets already constructed",
				result: markets,
			};
		}

		console.log("Constructing markets...");
		const marketList: Market[] = [];
		const tokensArray = Array.from(tokenMap.entries());

		for (let i = 0; i < tokensArray.length; i++) {
			for (let j = i + 1; j < tokensArray.length; j++) {
				const market: Market = {
					tokenSymbol1: tokensArray[i][1],
					tokenSymbol2: tokensArray[j][1],
				};
				marketList.push(market);
			}
		}
		setMarkets(marketList);

		console.log("Markets constructed:", marketList);
		return {
			status: "Success",
			message: "Markets constructed",
			result: marketList,
		};
	};

	const createOrder = async (
		tokenSymbol1: string,
		tokenSymbol2: string,
		price: number,
		amount: number,
		type: OrderType,
		nature: OrderNature
	): Promise<InvokeResponse<any>> => {
		if (!isContractInitialized(contract)) {
			return {
				status: "Error",
				message: "Contract not initialized",
				result: null,
			};
		}

		try {
			let result;
			if (type === "Buy") {
				result = await contract.exchange.methods
					.placeBuyOrder(
						tokenSymbol1,
						tokenSymbol2,
						price,
						amount,
						nature === "Market" ? 0 : 1
					)
					.send({ from: account });
			} else {
				result = await contract.exchange.methods
					.placeSellOrder(
						tokenSymbol1,
						tokenSymbol2,
						price,
						amount,
						nature === "Market" ? 0 : 1
					)
					.send({ from: account });
			}
			console.log("Order created:", result);

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

	const fetchActiveOrders = async (
		market: Market,
		all?: boolean
	): Promise<InvokeResponse<Order[]>> => {
		if (!isContractInitialized(contract)) {
			return {
				status: "Error",
				message: "Contract not initialized",
				result: [],
			};
		}

		let activeOrders;
		try {
			console.log(
				"Fetching active orders...",
				market.tokenSymbol1,
				market.tokenSymbol2,
				account
			);

			if (all) {
				activeOrders = await contract.exchange.methods
					.getAllActiveUserOrdersForAMarket(
						market.tokenSymbol1,
						market.tokenSymbol2
					)
					.call();
			} else {
				activeOrders = await contract.exchange.methods
					.getAllActiveUserOrdersForAMarket(
						market.tokenSymbol1,
						market.tokenSymbol2,
						account
					)
					.call();
			}
		} catch (error) {
			return {
				status: "Error",
				message: `Failed to fetch orders: ${error}`,
				result: [],
			};
		}

		const activeOrdersArr: Order[] = [];
		for (let i = 0; i < activeOrders[0].length; i++) {
			const order: Order = {
				price: Number(activeOrders[1][i]),
				quantity: Number(activeOrders[0][i]),
				type: activeOrders[2][i] === 0 ? "buy" : "sell",
				nature: activeOrders[3][i] === 0 ? "limit" : "market",
				status: "active",
				market: activeMarket
					? `${activeMarket.tokenSymbol1}/${activeMarket.tokenSymbol2}`
					: "",
			};
			activeOrdersArr.push(order);
		}
		console.log("Active orders:", activeOrdersArr);

		return {
			status: "Success",
			message: `Orders fetched!`,
			result: activeOrdersArr,
		};
	};

	const watchUserWithdrawals = () => {
		if (!isContractInitialized(contract)) {
			return {
				status: "Error",
				message: "Contract not initialized",
				result: null,
			};
		}

		contract.exchange.events
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
		const fetchData = async () => {
			const tokenRes = await fetchTokens();
			constructMarkets(tokenRes.result);
			await fetchBalance(tokenRes.result);
		};

		fetchData();
	}, [contract, account]);

	useEffect(() => {
		if (window.ethereum) {
			window.ethereum.on("accountsChanged", (accounts: any) => {
				const accountsString = accounts as string[];
				console.log("Account changed:", accountsString[0]);
				setAccount(accountsString[0]);
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

	// useEffect(() => {
	// 	if (!isContractInitialized(contract)) return;

	// 	console.log("Listening for DepositEvent...");
	// 	const subscription = contract.tokenManager.events.DepositEvent(
	// 		{
	// 			fromBlock: "latest",
	// 		},
	// 		(_, event: any) => {
	// 			console.log("DepositEvent:", event);
	// 		}
	// 	);

	// 	subscription.on("data", (event: any) => {
	// 		console.log("DepositEvent data:", event);
	// 	});

	// 	// Cleanup function to unsubscribe from the event
	// 	return () => {
	// 		subscription.unsubscribe((error: any, success: any) => {
	// 			if (success) {
	// 				console.log("Successfully unsubscribed!");
	// 			} else {
	// 				console.error("Error unsubscribing:", error);
	// 			}
	// 		});
	// 	};
	// }, [contract]);

	const controller: DEXController = {
		connectWallet,
		fetchBalance,
		updateBalance,
		deposit,
		withdraw,
		createOrder,
		setActiveMarket,
		fetchActiveOrders,
	};

	const contextValue = useMemo<Web3ContextType>(
		() => ({
			web3,
			isWalletConnected,
			account,
			contract,
			networkId,
			controller,
			balance,
			tokens,
			activeMarket,
			markets,
		}),
		[
			web3,
			isWalletConnected,
			account,
			contract,
			networkId,
			controller,
			balance,
			tokens,
			activeMarket,
			markets,
		]
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
