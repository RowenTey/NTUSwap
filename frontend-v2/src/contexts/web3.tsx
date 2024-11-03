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

export const Web3Context = createContext<Web3ContextType | null>(null);

export function Web3Provider({ children }: Web3ProviderProps) {
	const [web3, setWeb3] = useState<Web3 | null>(null);
	const [account, setAccount] = useState<string | null>(null);
	const [contract, setContract] = useState<DEXContract | null>(null);
	const [networkId, setNetworkId] = useState<string | null>(null);

	const initializeWeb3 = useCallback(async () => {
		if (!window.ethereum) {
			console.log("Please install MetaMask!");
			return;
		}

		const web3Instance = new Web3(window.ethereum);
		try {
			await window.ethereum.request({ method: "eth_requestAccounts" });
			setWeb3(web3Instance);

			const accounts = await web3Instance.eth.getAccounts();
			console.log("Account:", accounts[0]);
			setAccount(accounts[0]);

			const retrievedNetworkId = await web3Instance.eth.net.getId();
			console.log("Network ID:", retrievedNetworkId);
			setNetworkId(retrievedNetworkId.toString());

			// Load the smart contract
			const contractData = await fetch("/src/contracts/Exchange.json");
			const contractABI: ContractJSON = await contractData.json();
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

	useEffect(() => {
		initializeWeb3();
	}, [initializeWeb3]);

	useEffect(() => {
		if (window.ethereum) {
			window.ethereum.on("accountsChanged", (accounts: any) => {
				const accountsString = accounts as string[];
				setAccount(accountsString[0]);
			});

			window.ethereum.on("chainChanged", () => {
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
			account,
			contract,
			networkId,
			initializeWeb3,
		}),
		[web3, account, contract, networkId, initializeWeb3]
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
