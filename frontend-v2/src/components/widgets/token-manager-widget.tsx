import { FC, FormEvent, useState } from "react";
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

const TokenManagerWidget: FC = () => {
	const { toast } = useToast();
	const [operation, setOperation] = useState<"deposit" | "withdraw">("deposit");
	const [selectedToken, setSelectedToken] = useState("ntu");
	const [quantity, setQuantity] = useState<number | string>("");

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();

		if (Number(quantity) <= 0) {
			toast({
				title: "Please enter a valid quantity.",
				variant: "destructive",
			});
			return;
		}

		const tokenData = {
			operation,
			selectedToken,
			quantity: Number(quantity),
		};

		console.log("Token operation submitted:", tokenData);
		// Add your form submission logic here
	};

	const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setQuantity(e.target.value);
	};

	return (
		<div className="w-full flex flex-col gap-3 bg-slate-300 p-4 items-center rounded-md border">
			<p className="text-2xl font-bold">Manage Token</p>
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
					defaultValue="ntu"
					onValueChange={(value) => setSelectedToken(value)}
				>
					<SelectTrigger className="w-[180px]">
						<SelectValue placeholder="Select Token" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="ntu">NTU</SelectItem>
						<SelectItem value="nus">NUS</SelectItem>
					</SelectContent>
				</Select>
				<div className="grid w-full max-w-sm items-center gap-1.5">
					<Input
						type="number"
						id="quantity"
						placeholder="Quantity"
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
