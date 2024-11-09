import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Web3Layout from "@/components/web3Layout";

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

export const metadata: Metadata = {
	title: "NTUSwap",
	description: "Trade crypto and get rich",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased background-color from-slate-400 to-slate-950 `}
			>
				<Web3Layout>{children}</Web3Layout>
			</body>
		</html>
	);
}
