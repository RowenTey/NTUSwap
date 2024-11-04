"use client";
import { FC, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWeb3 } from "@/contexts/web3";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const DashboardPage: FC = () => {
	const router = useRouter();
	const { isWalletConnected } = useWeb3();

	useEffect(() => {
		if (!isWalletConnected) {
			router.push("/");
		}
	}, []);

	return (
		<div className="h-dvh-with-nav flex flex-col items-center justify-center gap-6">
			<h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl text-white">
				Issue Token
			</h1>

			<form className="flex flex-col gap-3">
				<Input
					id="name"
					placeholder="Token Name"
					// value={quantity}
					// onChange={handleQuantityChange}
				/>
				<Input
					id="symbol"
					placeholder="Token Symbol"
					// value={quantity}
					// onChange={handleQuantityChange}
				/>
				<Input
					type="number"
					id="initialSupply"
					placeholder="Initial Supply"
					// value={quantity}
					// onChange={handleQuantityChange}
				/>
				<Button variant="outline" type="submit" className="mt-3">
					Create Token
				</Button>
			</form>
		</div>
	);
};

export default DashboardPage;
