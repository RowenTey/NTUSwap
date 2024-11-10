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
import { Fill, Order } from "@/components/columns/order-book-table";
import { useToast } from "@/hooks/use-toast";

interface DEXContract {
	exchange: any | null;
	tokenManager: any | null;
	marketManager: any | null;
	orderBookManager: any | null;
}

interface DEXController {
	connectWallet: () => Promise<void>;
	getOwner: () => Promise<string>;
	fetchBalance: (
		tokenMap: Token
	) => Promise<InvokeResponse<Map<string, number>>>;
	updateBalance: (symbol: string, amount: number) => void;
	issueToken: (
		name: string,
		symbol: string,
		initialSupply: number
	) => Promise<InvokeResponse<any>>;
	deposit: (symbol: string, amount: number) => Promise<InvokeResponse<any>>;
	withdraw: (symbol: string, amount: number) => Promise<InvokeResponse<any>>;
	createOrder: (
		targetToken: string,
		market: Market,
		price: number,
		amount: number,
		type: OrderType,
		nature: OrderNature
	) => Promise<InvokeResponse<any>>;
	setActiveMarket: React.Dispatch<React.SetStateAction<Market | null>>;
	fetchOrders: (
		market: Market,
		status: OrderStatusQueryFilters,
		all: boolean
	) => Promise<InvokeResponse<Order[]>>;
	cancelOrder: (
		tokenSymbol1: string,
		tokenSymbol2: string,
		orderId: number,
		type: OrderType,
		nature: OrderNature
	) => Promise<InvokeResponse<any>>;
	setRefetchOrders: React.Dispatch<
		React.SetStateAction<{
			marketTable: boolean;
			orderBookTable: boolean;
		}>
	>;
	getMarketPrice: (market: Market) => Promise<InvokeResponse<[number, number]>>;
	setMatched: React.Dispatch<React.SetStateAction<string>>;
	setRefresh: React.Dispatch<React.SetStateAction<boolean>>;
}

interface Web3ContextType {
	web3Obj: Web3 | null;
	isWalletConnected: boolean;
	account: string | null;
	contract: DEXContract | null;
	networkId: string | null;
	balance: Map<string, number>;
	tokens: Token;
	activeMarket: Market | null;
	markets: Market[];
	refetchOrders: {
		marketTable: boolean;
		orderBookTable: boolean;
	};
	matched: string;
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

// token name -> [symbol, id]
export type Token = Map<string, [string, number]>;

export type OrderStatusQueryFilters = "ALL" | "ACTIVE" | "CANCELLED" | "FILLED";

export interface Market {
	id: string;
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
	const { toast } = useToast();
	const [web3Obj, setWeb3Obj] = useState<Web3 | null>(null);
	const [contract, setContract] = useState<DEXContract | null>(null);
	const [isWalletConnected, setIsWalletConnected] = useState<boolean>(false);

	const [networkId, setNetworkId] = useState<string>("");
	const [account, setAccount] = useState<string>("");

	const [markets, setMarkets] = useState<Market[]>([]);
	const [tokens, setTokens] = useState<Token>(new Map());

	const [balance, setBalance] = useState<Map<string, number>>(new Map());
	const [activeMarket, setActiveMarket] = useState<Market | null>(null);

	const [refresh, setRefresh] = useState<boolean>(false);
	const [refetchOrders, setRefetchOrders] = useState<{
		marketTable: boolean;
		orderBookTable: boolean;
	}>({ marketTable: false, orderBookTable: false });
	const [matched, setMatched] = useState<string>("");

	const connectWallet = useCallback(async () => {
		if (!window.ethereum) {
			toast({
				title: "Please install MetaMask!",
				variant: "destructive",
			});
			return;
		}

		const initialized = isWalletConnected && account && web3Obj && contract;
		if (initialized) {
			console.log("Web3 already initialized!");
			return;
		}

		console.log("Initializing Web3...");
		const web3Instance = new Web3(window.ethereum);
		try {
			await window.ethereum.request({ method: "eth_requestAccounts" });
			setWeb3Obj(web3Instance);

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

	const getTokenDetails = async (
		dexContract: DEXContract,
		symbol: string
	): Promise<{ tokenId: number; tokenAddr: string }> => {
		try {
			const tokenId = Number(
				await dexContract.tokenManager.methods.getTokenId(symbol).call()
			);

			const userBalance = await dexContract.tokenManager.methods
				.getBalance(account, tokenId)
				.call();
			console.log("User balance in tokenManager:", userBalance);

			const tokenAddr = await dexContract.tokenManager.methods
				.getToken(tokenId)
				.call();
			return { tokenId, tokenAddr };
		} catch (error) {
			throw new Error(`Failed to get token details: ${error}`);
		}
	};

	const approveTokenSpending = async (
		tokenContract: any,
		spenderAddress: string,
		amount: string,
		account: string
	): Promise<void> => {
		try {
			await tokenContract.methods
				.approve(spenderAddress, amount)
				.send({ from: account });
		} catch (error) {
			throw new Error(`Failed to approve token spending: ${error}`);
		}
	};

	const getOwner = async (): Promise<string> => {
		if (!isContractInitialized(contract)) {
			return "";
		}

		try {
			const ownerAddress = await contract.tokenManager.methods.owner().call();
			// console.log("Owner address:", ownerAddress);
			return ownerAddress;
		} catch (error) {
			console.error("Failed to fetch owner address:", error);
			return "";
		}
	};

	const issueToken = async (
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

		const initialSupplyInWei = Web3.utils.toWei(
			initialSupply.toString(),
			"ether"
		);

		try {
			// TODO: set as env var
			console.log("Issuing token...", name, symbol, initialSupply);
			const result = await contract.tokenManager.methods
				.issueToken(name, symbol, initialSupplyInWei)
				.send({ from: account, gas: 10000000 }); // set higher gas price
			console.log("Token issued:", result);
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

		const amountInWei = Web3.utils.toWei(amount.toString(), "ether");

		try {
			const { tokenAddr } = await getTokenDetails(contract, symbol);
			const tokenContract = await initializeTokenContract(
				web3Obj as Web3,
				tokenAddr
			);

			await approveTokenSpending(
				tokenContract,
				contract.tokenManager._address,
				amountInWei,
				// amount.toString(),
				account
			);

			const result = await contract.exchange.methods
				.withdrawTokens(symbol, amountInWei)
				// .withdrawTokens(symbol, amount)
				.send({ from: account });
			console.log("Withdrawal result:", result);

			return {
				status: "Success",
				message: `Withdrawal successful: ${result.transactionHash}`,
				result,
			};
		} catch (error) {
			console.error(error);
			return {
				status: "Error",
				message: error as string,
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

		const amountInWei = Web3.utils.toWei(amount.toString(), "ether");

		try {
			const { tokenId, tokenAddr } = await getTokenDetails(contract, symbol);
			console.log("Token details:", tokenId, tokenAddr);
			const tokenContract = await initializeTokenContract(
				web3Obj as Web3,
				tokenAddr
			);

			const balance = await tokenContract.methods.balanceOf(account).call();
			console.log("Token balance:", balance);

			await approveTokenSpending(
				tokenContract,
				contract.tokenManager._address,
				amountInWei,
				// amount.toString(),
				account
			);

			const result = await contract.exchange.methods
				.depositTokens(symbol, amountInWei)
				// .depositTokens(symbol, amount)
				.send({ from: account });
			console.log("Deposit result:", result);

			return {
				status: "Success",
				message: `Deposit successful: ${result.transactionHash}`,
				result,
			};
		} catch (error) {
			console.error(error);
			return {
				status: "Error",
				message: error as string,
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
		tokenMap: Token
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
			console.log("Fetched balance:", fetchedBalance);

			const balanceMap = new Map<string, number>();
			for (let i = 0; i < fetchedBalance[0].length; i++) {
				const tokenName = fetchedBalance[1][i];
				const tokenData = tokenMap.get(tokenName);
				const tokenSymbol = tokenData ? tokenData[0] : undefined;
				if (!tokenSymbol) {
					console.error(`Token not found: ${tokenName}`);
					continue;
				}

				const tokenBalance = Number(
					Web3.utils.fromWei(fetchedBalance[0][i], "ether")
					// fetchedBalance[0][i]
				);
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

	const fetchTokens = async (): Promise<InvokeResponse<Token>> => {
		if (!isContractInitialized(contract)) {
			return {
				status: "Error",
				message: "Contract not initialized",
				result: new Map(),
			};
		}

		try {
			console.log("Fetching tokens...");
			const fetchedTokens = await contract.exchange.methods
				.getAllAvailableTokens()
				.call();

			console.log("Fetched tokens:", fetchedTokens);
			const tokenMap = new Map<string, [string, number]>();
			for (let i = 0; i < fetchedTokens[0].length; i++) {
				const { tokenId } = await getTokenDetails(
					contract,
					fetchedTokens[1][i]
				);

				tokenMap.set(fetchedTokens[0][i], [fetchedTokens[1][i], tokenId]);
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

	const getTokenSymbol = (tokenMap: Token, tokenId: number): string => {
		const tokensArray = Array.from(tokenMap.values());

		for (let i = 0; i < tokensArray.length; i++) {
			if (tokensArray[i][1] === tokenId) {
				return tokensArray[i][0];
			}
		}

		console.error(`Token not found for tokenId: ${tokenId}`);
		return "";
	};

	const fetchMarkets = async (
		tokenMap: Token
	): Promise<InvokeResponse<Market[]>> => {
		if (!isContractInitialized(contract)) {
			return {
				status: "Error",
				message: "Contract not initialized",
				result: [],
			};
		}

		try {
			console.log("Fetching balance for account: ", account);
			const fetchedMarkets = await contract.exchange.methods
				.getAllMarkets()
				.call();
			console.log("Fetched markets:", fetchedMarkets);

			const marketList: Market[] = [];
			for (let i = 0; i < fetchedMarkets[0].length; i++) {
				const token1Id = Number(fetchedMarkets[1][i]);
				const token2Id = Number(fetchedMarkets[2][i]);

				const market: Market = {
					id: fetchedMarkets[0][i],
					tokenSymbol1: getTokenSymbol(tokenMap, token1Id),
					tokenSymbol2: getTokenSymbol(tokenMap, token2Id),
				};
				marketList.push(market);
			}
			console.log("Markets:", marketList);
			setMarkets(marketList);

			return {
				status: "Success",
				message: `Markets fetched: ${Array.from(marketList.entries())}`,
				result: marketList,
			};
		} catch (error) {
			return {
				status: "Error",
				message: `Failed to fetch market: ${error}`,
				result: [],
			};
		}
	};

	// const constructMarkets = (tokenMap: Token): InvokeResponse<Market[]> => {
	// 	if (tokenMap.size === 0) {
	// 		return {
	// 			status: "Error",
	// 			message: "Tokens not fetched",
	// 			result: [],
	// 		};
	// 	}

	// 	if (markets.length > 0) {
	// 		return {
	// 			status: "Success",
	// 			message: "Markets already constructed",
	// 			result: markets,
	// 		};
	// 	}

	// 	console.log("Constructing markets...");
	// 	const marketList: Market[] = [];
	// 	const tokensArray = Array.from(tokenMap.entries());

	// 	for (let i = 0; i < tokensArray.length; i++) {
	// 		for (let j = i + 1; j < tokensArray.length; j++) {
	// 			const market: Market = {
	// 				tokenSymbol1: tokensArray[i][0],
	// 				tokenSymbol2: tokensArray[j][0],
	// 			};
	// 			marketList.push(market);
	// 		}
	// 	}
	// 	setMarkets(marketList);

	// 	console.log("Markets constructed:", marketList);
	// 	return {
	// 		status: "Success",
	// 		message: "Markets constructed",
	// 		result: marketList,
	// 	};
	// };

	const createOrder = async (
		targetToken: string,
		market: Market,
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

		// Convert amount to Wei
		const amountInWei = Web3.utils.toWei(amount.toString(), "ether");
		const priceInWei = Web3.utils.toWei(price.toString(), "ether");

		/* 
			TokA/TokB
			
			BUY -> buying tokenA using tokenB
			SELLING -> selling tokenA for tokenB
		*/

		const pairedToken =
			targetToken === market.tokenSymbol1
				? market.tokenSymbol2
				: market.tokenSymbol1;

		let incomingToken, exchangeToken;
		if (type === "Buy") {
			incomingToken = targetToken;
			exchangeToken = pairedToken;
		} else {
			incomingToken = pairedToken;
			exchangeToken = targetToken;
		}

		try {
			let result;

			if (nature === "Market") {
				console.log(
					`Creating market order for ${incomingToken} using currency ${exchangeToken}`
				);
				result = await contract.exchange.methods
					.placeMarketOrder(
						incomingToken, // want
						exchangeToken, // sell
						amountInWei,
						type === "Buy" ? 0 : 1
					)
					.send({ from: account });
			} else {
				console.log(
					`Creating limit order for ${incomingToken} using currency ${exchangeToken}`
				);
				result = await contract.exchange.methods
					.placeLimitOrder(
						incomingToken,
						exchangeToken,
						priceInWei,
						// price,
						amountInWei,
						type === "Buy" ? 0 : 1
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

	const fetchOrders = async (
		market: Market,
		status: OrderStatusQueryFilters = "ACTIVE",
		all: boolean = false
	): Promise<InvokeResponse<Order[]>> => {
		if (!isContractInitialized(contract)) {
			return {
				status: "Error",
				message: "Contract not initialized",
				result: [],
			};
		}

		let orders = [];
		try {
			console.log(
				"Fetching orders...",
				market.tokenSymbol1,
				market.tokenSymbol2,
				status,
				account
			);

			switch (status) {
				case "ACTIVE":
					console.log("Fetching active orders...");
					if (all) {
						orders = await contract.exchange.methods
							.getAllActiveOrdersForAMarket(
								market.tokenSymbol1,
								market.tokenSymbol2
							)
							.call();
					} else {
						orders = await contract.exchange.methods
							.getAllActiveUserOrdersForAMarket(
								market.tokenSymbol1,
								market.tokenSymbol2,
								account
							)
							.call();
					}
					break;
				case "CANCELLED":
					console.log("Fetching cancelled orders...");
					orders = await contract.exchange.methods
						.getAllCancelledUserOrdersForAMarket(
							market.tokenSymbol1,
							market.tokenSymbol2,
							account
						)
						.call();
					break;
				case "FILLED":
					console.log("Fetching filled orders...");
					orders = await contract.exchange.methods
						.getAllFulfilledUserOrdersForAMarket(
							market.tokenSymbol1,
							market.tokenSymbol2,
							account
						)
						.call();
					break;
				default:
					console.error("Invalid status:", status);
					return {
						status: "Error",
						message: "Invalid status",
						result: [],
					};
			}
		} catch (error) {
			return {
				status: "Error",
				message: `Failed to fetch orders: ${error}`,
				result: [],
			};
		}
		console.log("Orders fetched:", orders);

		const ordersArr: Order[] = [];
		for (let i = 0; i < orders[0].length; i++) {
			const fills: Fill[] = [];
			for (let j = 0; j < orders[5][i].length; j++) {
				const fill: Fill = {
					price: Number(Web3.utils.fromWei(orders[5][i][j], "ether")),
					// price: Number(orders[5][i]),
					quantity: Number(Web3.utils.fromWei(orders[6][i][j], "ether")),
					timestamp: Number(orders[7][i][j]),
				};
				fills.push(fill);
			}

			const order: Order = {
				id: Number(orders[2][i]),
				price: Number(Web3.utils.fromWei(orders[1][i], "ether")),
				// price: Number(orders[1][i]),
				quantity: Number(Web3.utils.fromWei(orders[0][i], "ether")),
				type: Number(orders[3][i]) === 0 ? "Buy" : "Sell",
				nature: Number(orders[4][i]) === 0 ? "Market" : "Limit",
				status: status.toLowerCase() as "active" | "filled" | "cancelled",
				market: activeMarket
					? `${activeMarket.tokenSymbol1}/${activeMarket.tokenSymbol2}`
					: "",
				fills: fills.reverse(), // sort fills in descending order (latest first)
			};
			ordersArr.push(order);
		}
		console.log("Orders:", ordersArr);

		return {
			status: "Success",
			message: `Orders fetched!`,
			result: ordersArr.reverse(), // sort orders in descending order (latest first)
		};
	};

	const cancelOrder = async (
		tokenSymbol1: string,
		tokenSymbol2: string,
		orderId: number,
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

		const { tokenId: tokenId1 } = await getTokenDetails(contract, tokenSymbol1);
		const { tokenId: tokenId2 } = await getTokenDetails(contract, tokenSymbol2);

		try {
			console.log(`Cancelling order...`, orderId, type, nature);
			const result = await contract.exchange.methods
				.cancelOrder(
					tokenId1,
					tokenId2,
					orderId,
					type === "Buy" ? 0 : 1,
					nature === "Limit" ? 1 : 0
				)
				.send({ from: account });
			console.log("Order cancelled:", result);
			return {
				status: "Success",
				message: `Order cancelled: ${result.transactionHash}`,
				result,
			};
		} catch (error) {
			return {
				status: "Error",
				message: `Failed to cancel order: ${error}`,
				result: null,
			};
		}
	};

	const getMarketPrice = async (
		market: Market
	): Promise<InvokeResponse<[number, number]>> => {
		if (!isContractInitialized(contract)) {
			return {
				status: "Error",
				message: "Contract not initialized",
				result: [0, 0],
			};
		}

		const bestPrice = [0, 0]; // buy, sell

		try {
			const result = await contract.exchange.methods
				.getBestPriceInMarket(0, market.tokenSymbol1, market.tokenSymbol2)
				.call();
			console.log("Market price:", result);
			bestPrice[0] = Number(Web3.utils.fromWei(result, "ether"));
		} catch (error) {
			console.error("Failed to fetch market price:", error);
			return {
				status: "Error",
				message: "Failed to fetch market price",
				result: [0, 0],
			};
		}

		try {
			const result = await contract.exchange.methods
				.getBestPriceInMarket(1, market.tokenSymbol1, market.tokenSymbol2)
				.call();
			console.log("Market price:", result);
			bestPrice[1] = Number(Web3.utils.fromWei(result, "ether"));
		} catch (error) {
			console.error("Failed to fetch market price:", error);
			return {
				status: "Error",
				message: "Failed to fetch market price",
				result: [0, 0],
			};
		}

		return {
			status: "Success",
			message: `Market price fetched: ${bestPrice}`,
			result: bestPrice as [number, number],
		};
	};

	const checkUserInvolvedInSettlement = (
		userAddr: string,
		from: string,
		to: string
	): boolean => {
		return (
			userAddr.toLowerCase() === from.toLowerCase() ||
			userAddr.toLowerCase() === to.toLowerCase()
		);
	};

	const fetchData = async () => {
		const tokenRes = await fetchTokens();
		await fetchMarkets(tokenRes.result);
		await fetchBalance(tokenRes.result);
	};

	useEffect(() => {
		fetchData();
	}, [contract, account]);

	useEffect(() => {
		if (!refresh) return;
		fetchData();
		setRefresh(false);
	}, [refresh]);

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

	useEffect(() => {
		if (!contract || !activeMarket || tokens.size === 0) return;

		const subscription = contract.exchange.events.TransferProcessed({
			fromBlock: "latest",
		});

		subscription.on("data", async (event: any) => {
			console.log(
				"[web3Context] TransferProcessed event:",
				event,
				checkUserInvolvedInSettlement(
					account as string,
					event.returnValues.from as string,
					event.returnValues.to as string
				)
			);

			if (
				!checkUserInvolvedInSettlement(
					account as string,
					event.returnValues.from as string,
					event.returnValues.to as string
				)
			)
				return;

			setMatched(event.transactionHash);

			// trigger refetch of balance and orders
			await fetchBalance(tokens);
			setRefetchOrders({
				marketTable: true,
				orderBookTable: true,
			});
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

	const controller: DEXController = {
		connectWallet,
		getOwner,
		fetchBalance,
		updateBalance,
		issueToken,
		deposit,
		withdraw,
		createOrder,
		setActiveMarket,
		fetchOrders,
		cancelOrder,
		setRefetchOrders,
		getMarketPrice,
		setMatched,
		setRefresh,
	};

	const contextValue = useMemo<Web3ContextType>(
		() => ({
			web3Obj,
			isWalletConnected,
			account,
			contract,
			networkId,
			controller,
			balance,
			tokens,
			activeMarket,
			markets,
			refetchOrders,
			matched,
		}),
		[
			web3Obj,
			isWalletConnected,
			account,
			contract,
			networkId,
			controller,
			balance,
			tokens,
			activeMarket,
			markets,
			refetchOrders,
			matched,
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
