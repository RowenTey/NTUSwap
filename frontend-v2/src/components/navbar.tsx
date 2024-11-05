"use client";
import { FC, useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useWeb3 } from "@/contexts/web3";
import Link from "next/link";
import { formatAddress } from "@/lib/utils";

const Navbar: FC = () => {
	const { account, contract, controller } = useWeb3();
	const { getOwner } = controller;
	const [owner, setOwner] = useState<string>("");

	useEffect(() => {
		const fetchOwner = async () => {
			const res = await getOwner();
			setOwner(res);
		};

		fetchOwner();
	}, [account, contract]);

	return (
		<nav className="sticky top-2 h-[10%] w-full flex justify-center z-[999]">
			<div className="bg-black w-[90%] rounded border-2 border-white py-1 px-3 flex justify-between text-white">
				<div className="flex gap-8">
					<Link href="/" className="font-bold">
						NTUSwap
					</Link>
					<div className="flex gap-3">
						<Link href="/dashboard" className="hover:underline">
							Dashboard
						</Link>
						{account === owner && (
							<Link href="/issue" className="hover:underline">
								Issue
							</Link>
						)}
					</div>
				</div>

				{account && (
					<div className="flex gap-2">
						<Avatar style={{ width: "22.5px", height: "22.5px" }}>
							<AvatarImage src="https://github.com/shadcn.png" />
							<AvatarFallback>CN</AvatarFallback>
						</Avatar>
						<span>{formatAddress(account)}</span>
					</div>
				)}
			</div>
		</nav>
	);
};

export default Navbar;
