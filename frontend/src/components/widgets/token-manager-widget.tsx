import { FC, FormEvent, useMemo, useState } from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useWeb3 } from "@/contexts/web3";

const TokenManagerWidget: FC = () => {
	const { toast } = useToast();
	const { tokens, controller } = useWeb3();
	const { deposit, withdraw, updateBalance } = controller;
	const tokensArr = useMemo(() => {
		return Array.from(tokens.values()).map((t) => t[0]);
	}, [tokens]);
	const [operation, setOperation] = useState<"deposit" | "withdraw">("deposit");
	const [selectedToken, setSelectedToken] = useState(tokensArr[0]);
	const [quantity, setQuantity] = useState<number | string>("");

	const resetForm = () => {
		setQuantity("");
		setSelectedToken(tokensArr[0]);
	};

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();

		if (Number(quantity) <= 0) {
			toast({
				title: "Please enter a valid quantity.",
				variant: "destructive",
			});
			return;
		}

		if (operation === "deposit") {
			const res = await deposit(selectedToken, Number(quantity));
			if (res.status !== "Success") {
				toast({
					title: "Deposit failed.",
					variant: "destructive",
				});
				return;
			}

			toast({
				title: "Deposit successful.",
			});
			resetForm();
			updateBalance(selectedToken, Number(quantity));
		} else {
			const res = await withdraw(selectedToken, Number(quantity));
			if (res.status !== "Success") {
				toast({
					title: "Withdrawal failed.",
					variant: "destructive",
				});
				return;
			}

			toast({
				title: "Withdrawal successful.",
			});
			resetForm();
			updateBalance(selectedToken, -1 * Number(quantity));
		}
	};

	const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setQuantity(e.target.value);
	};

	return (
		<div className="w-full flex flex-col gap-3 bg-zinc-300 p-4 items-center rounded-md border">
			<p className="text-xl font-bold">Manage Token</p>
			<form
				onSubmit={handleSubmit}
				className="flex flex-col gap-2 items-center"
			>
				<ToggleGroup
					type="single"
					defaultValue="deposit"
					onValueChange={(value) =>
						setOperation(value as "deposit" | "withdraw")
					}
				>
					<ToggleGroupItem value="deposit">Deposit</ToggleGroupItem>
					<ToggleGroupItem value="withdraw">Withdraw</ToggleGroupItem>
				</ToggleGroup>
				<Select
					defaultValue={tokensArr[0]}
					onValueChange={(value) => setSelectedToken(value)}
				>
					<SelectTrigger className="w-[180px]">
						<SelectValue placeholder="Select Token" />
					</SelectTrigger>
					<SelectContent>
						{tokensArr.map((token) => (
							<SelectItem key={token} value={token}>
								{token}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<div className="grid w-full max-w-sm items-center gap-1.5">
					<Input
						type="number"
						id="quantity"
						placeholder="Quantity"
						className="border-zinc-700"
						value={quantity}
						onChange={handleQuantityChange}
					/>
				</div>
				<Button type="submit">Submit</Button>
			</form>
		</div>
	);
};

export default TokenManagerWidget;
