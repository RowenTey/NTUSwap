"use client";
import { FC, useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useWeb3 } from "@/contexts/web3";
import Link from "next/link";
import { formatAddress } from "@/lib/utils";
import { usePathname } from "next/navigation";

const Navbar: FC = () => {
	const { isWalletConnected, account, contract, controller } = useWeb3();
	const { getOwner } = controller;
	const [owner, setOwner] = useState<string>("");
	const [activeTab, setActiveTab] = useState<string>("");
	const pathname = usePathname();

	useEffect(() => {
		const fetchOwner = async () => {
			const res = await getOwner();
			setOwner(res);
		};

		fetchOwner();
	}, [account, contract]);

	useEffect(() => {
		setActiveTab(pathname.slice(1));
	}, [pathname]);

	const handleTabClick = (tab: string) => {
		if (!tab) {
			setActiveTab("");
			return;
		}

		setActiveTab(tab);
	};

	return (
		<nav className="sticky top-2 h-[10%] w-full flex justify-center z-[999]">
			<div className="background-color w-[80%] rounded border-2 border-white py-1 px-3 flex justify-between text-white">
				<div className="flex gap-8">
					<Link
						href="/"
						onClick={() => handleTabClick("")}
						className="font-bold"
					>
						NTUSwap
					</Link>
					<div className="flex gap-3">
						<Link
							href="/dashboard"
							onClick={() => handleTabClick("dashboard")}
							className={`${
								activeTab === "dashboard" ? "italic" : "hover:underline"
							}`}
						>
							Dashboard
						</Link>
						{isWalletConnected && account === owner && (
							<Link
								href="/issue"
								onClick={() => handleTabClick("issue")}
								className={`${
									activeTab === "issue" ? "italic" : "hover:underline"
								}`}
							>
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
