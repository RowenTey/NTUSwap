import { useState, useEffect } from "react";
import Web3 from "web3";
import BuyOrderForm from "./components/BuyOrderForm";
import SellOrderForm from "./components/SellOrderForm";
import OrdersList from "./components/OrdersList";

function App() {
	const [web3, setWeb3] = useState(null);
	const [account, setAccount] = useState(null);
	const [contract, setContract] = useState(null);

	useEffect(() => {
		loadWeb3();
	}, []);

	const loadWeb3 = async () => {
		if (!window.ethereum) {
			alert("Please install MetaMask!");
			return;
		}

		const web3 = new Web3(window.ethereum);
		await window.ethereum.request({ method: "eth_requestAccounts" });
		setWeb3(web3);

		const accounts = await web3.eth.getAccounts();
		setAccount(accounts[0]);

		// Load the smart contract
		const networkId = await web3.eth.net.getId();
		const contractData = await fetch("./src/contracts/LimitOrderExchange.json");
		const contractABI = await contractData.json();
		const contractAddress = contractABI.networks[networkId].address;
		const contractInstance = new web3.eth.Contract(
			contractABI.abi,
			contractAddress
		);
		setContract(contractInstance);
	};

	return (
		<div>
			<h1>DEX Frontend</h1>
			{account ? (
				<>
					<div>Connected as: {account}</div>
					<BuyOrderForm web3={web3} contract={contract} account={account} />
					<SellOrderForm web3={web3} contract={contract} account={account} />
					<OrdersList account={account} contract={contract} />
				</>
			) : (
				<button onClick={loadWeb3}>Connect Wallet</button>
			)}
		</div>
	);
}

export default App;
