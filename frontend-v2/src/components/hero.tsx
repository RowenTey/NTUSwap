"use client";
import { useEffect, FC } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Wallet, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWeb3 } from "@/contexts/web3";

const Hero: FC = () => {
	const router = useRouter();
	const { toast } = useToast();
	const { controller, isWalletConnected, account } = useWeb3();
	const { connectWallet } = controller;

	useEffect(() => {
		router.prefetch("/dashboard");
		if (isWalletConnected) {
			console.log("Wallet connected!");
			return;
		}

		connectWallet();
	}, []);

	const navigate = () => {
		if (!isWalletConnected) {
			toast({
				title: "Wallet not connected!",
				variant: "destructive",
			});
			return;
		}
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

			<div
				className={`mt-4 flex justify-center gap-3 ${
					isWalletConnected ? "flex-col items-center" : ""
				}`}
			>
				{isWalletConnected ? (
					<span>Connected as {account}</span>
				) : (
					<Button onClick={connectWallet} className="w-full sm:w-auto">
						Connect MetaMask <Wallet className="ml-2 h-4 w-4" />
					</Button>
				)}

				<Button
					onClick={navigate}
					variant="secondary"
					className={`${isWalletConnected ? "w-[30%]" : "w-full"} sm:w-auto`}
				>
					Start Trading <ArrowRight className="ml-2 h-4 w-4" />
				</Button>
			</div>
		</div>
	);
};

export default Hero;
