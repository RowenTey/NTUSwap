import {
	createContext,
	useState,
	useEffect,
	useCallback,
	useMemo,
	useContext,
} from "react";
import PropTypes from "prop-types";
import Web3 from "web3";

export const Web3Context = createContext(null);

Web3Provider.propTypes = {
	children: PropTypes.node.isRequired,
};

export function Web3Provider({ children }) {
	const [web3, setWeb3] = useState(null);
	const [account, setAccount] = useState(null);
	const [contract, setContract] = useState(null);
	const [networkId, setNetworkId] = useState(null);

	const initializeWeb3 = useCallback(async () => {
		if (window.ethereum) {
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
				const contractABI = await contractData.json();
				const contractAddress =
					contractABI.networks[retrievedNetworkId].address;
				console.log("Contract address:", contractAddress);
				const contractInstance = new web3Instance.eth.Contract(
					contractABI.abi,
					contractAddress
				);
				setContract(contractInstance);
			} catch (error) {
				console.error(
					"Failed to load web3, accounts, or contract. Check console for details."
				);
				console.error(error);
			}
		} else {
			console.log("Please install MetaMask!");
		}
	}, []);

	useEffect(() => {
		initializeWeb3();
	}, [initializeWeb3]);

	useEffect(() => {
		if (window.ethereum) {
			window.ethereum.on("accountsChanged", (accounts) => {
				setAccount(accounts[0]);
			});

			window.ethereum.on("chainChanged", () => {
				window.location.reload();
			});
		}
	}, []);

	const contextValue = useMemo(
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

export function useWeb3() {
	const context = useContext(Web3Context);
	if (context === undefined) {
		throw new Error("useWeb3 must be used within a Web3Provider");
	}
	return context;
}
