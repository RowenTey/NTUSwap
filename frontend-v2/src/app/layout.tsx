"use client";
// import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import { Web3Provider } from "@/contexts/web3";
import Navbar from "@/components/navbar";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
	src: "./fonts/GeistVF.woff",
	variable: "--font-geist-sans",
	weight: "100 900",
});
const geistMono = localFont({
	src: "./fonts/GeistMonoVF.woff",
	variable: "--font-geist-mono",
	weight: "100 900",
});

// export const metadata: Metadata = {
// 	title: "NTUSwap",
// 	description: "Trade crypto and get rich",
// };

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<Web3Provider>
			<html lang="en">
				<body
					// className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gradient-to-br from-slate-400 to-slate-950 `}
					className={`${geistSans.variable} ${geistMono.variable} antialiased background-color from-slate-400 to-slate-950 `}
				>
					<Navbar />
					<main>{children}</main>
					<Toaster />
				</body>
			</html>
		</Web3Provider>
	);
}
