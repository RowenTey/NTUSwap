"use client";
import { Toaster } from "@/components/ui/toaster";
import { Web3Provider } from "@/contexts/web3";
import Navbar from "@/components/navbar";

export default function Web3Layout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<Web3Provider>
			<Navbar />
			<main>{children}</main>
			<Toaster />
		</Web3Provider>
	);
}
