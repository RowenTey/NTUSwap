"use client";
import { FC, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWeb3 } from "@/contexts/web3";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const IssuePage: FC = () => {
	const router = useRouter();
	const { toast } = useToast();
	const { isWalletConnected, controller } = useWeb3();
	const { issueToken, setRefresh } = controller;
	const [name, setName] = useState<string>("");
	const [symbol, setSymbol] = useState<string>("");
	const [quantity, setQuantity] = useState<number | string>("");

	useEffect(() => {
		if (!isWalletConnected) {
			router.push("/");
		}
	}, []);

	const resetForm = () => {
		setName("");
		setSymbol("");
		setQuantity("");
	};

	const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setQuantity(Number(value));
	};

	const handleSymbolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setSymbol(value);
	};

	const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setName(value);
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		if (!name || !symbol || Number(quantity) <= 0) {
			toast({
				title: "Error",
				description: "All fields are required",
				variant: "destructive",
			});
			return;
		}

		const res = await issueToken(name, symbol, Number(quantity));
		if (res.status === "Error") {
			toast({
				title: "Error",
				description: res.message,
				variant: "destructive",
			});
			return;
		}

		toast({
			title: "Success",
			description: "Token issued successfully",
		});
		resetForm();
		setRefresh(true);
		router.push("/dashboard");
	};

	return (
		<div className="h-dvh-with-nav flex flex-col items-center justify-center gap-6">
			<h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl text-white">
				Issue Token
			</h1>

			<form onSubmit={handleSubmit} className="flex flex-col gap-3">
				<Input
					id="name"
					className="text-white placeholder:text-zinc-400"
					placeholder="Token Name"
					value={name}
					onChange={handleNameChange}
				/>
				<Input
					id="symbol"
					className="text-white placeholder:text-zinc-400"
					placeholder="Token Symbol"
					value={symbol}
					onChange={handleSymbolChange}
				/>
				<Input
					type="number"
					id="initialSupply"
					className="text-white placeholder:text-zinc-400"
					placeholder="Initial Supply"
					value={quantity}
					onChange={handleQuantityChange}
				/>
				<Button variant="outline" type="submit" className="mt-3">
					Create Token
				</Button>
			</form>
		</div>
	);
};

export default IssuePage;
