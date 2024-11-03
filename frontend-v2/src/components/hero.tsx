"use client";
import { useState, useEffect, FC } from "react";
import Web3, { Numbers } from "web3";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Wallet, ArrowRight } from "lucide-react";

const Hero: FC = () => {
	const router = useRouter();
	const [isWalletConnected, setIsWalletConnected] = useState<boolean>(false);
	const [web3, setWeb3] = useState<Web3 | null>(null);
	const [account, setAccount] = useState<string>("");
	const [balance, setBalance] = useState<string>("");

	useEffect(() => {
		const checkWalletConnection = async () => {
			if (typeof window.ethereum !== "undefined") {
				try {
					const web3Instance = new Web3(window.ethereum);
					setWeb3(web3Instance);
					const accounts = await web3Instance.eth.getAccounts();
					if (accounts.length > 0) {
						setIsWalletConnected(true);
						setAccount(accounts[0]);
						await fetchBalance(web3Instance, accounts[0]);
					}
				} catch (error) {
					console.error("Failed to check wallet connection:", error);
				}
			}
		};

		checkWalletConnection();
		router.prefetch("/dashboard");
	}, []);

	const connectWallet = async () => {
		if (typeof window.ethereum === "undefined" || !web3) {
			alert("Please install MetaMask to use this feature.");
			return;
		}

		try {
			await window.ethereum.request({ method: "eth_requestAccounts" });
			const accounts = await web3.eth.getAccounts();
			setIsWalletConnected(true);
			setAccount(accounts[0]);
			await fetchBalance(web3, accounts[0]);
		} catch (error) {
			console.error("Failed to connect wallet:", error);
		}
	};

	const fetchBalance = async (web3Instance: Web3, address: string) => {
		const tokenAddress = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
		const contract = new web3Instance.eth.Contract(
			ERC20_ABI as any,
			tokenAddress
		);

		try {
			const balance: Numbers = await contract.methods.balanceOf(address).call();
			setBalance(web3Instance.utils.fromWei(balance, "ether"));
		} catch (error) {
			console.error("Failed to fetch balance:", error);
		}
	};

	const navigate = () => {
		// if (!isWalletConnected) {
		// 	return;
		// }
		router.push("/dashboard");
	};

	return (
		<div className="h-dvh-with-nav flex flex-col items-center justify-center p-4">
			<h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl text-white">
				Welcome to NTUSwap
			</h1>

			<p className="leading-7 [&:not(:first-child)]:mt-6 text-white">
				Trade cryptocurrencies securely and efficiently on our decentralized
				exchange platform.
			</p>

			<div className="mt-4 flex justify-center gap-3">
				{isWalletConnected ? (
					<Button variant="secondary" className="w-full sm:w-auto">
						<Wallet className="mr-2 h-4 w-4" /> Wallet Connected
					</Button>
				) : (
					<Button onClick={connectWallet} className="w-full sm:w-auto">
						Connect MetaMask <Wallet className="ml-2 h-4 w-4" />
					</Button>
				)}

				<Button
					onClick={navigate}
					variant="secondary"
					className="w-full sm:w-auto"
				>
					Start Trading <ArrowRight className="ml-2 h-4 w-4" />
				</Button>
			</div>
		</div>
	);
};

export default Hero;
