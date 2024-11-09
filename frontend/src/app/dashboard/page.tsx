import { FC } from "react";
import Dashboard from "@/components/dashboard";
import { Metadata } from "next";

export const metadata: Metadata = {
	title: "NTUSwap | Dashboard",
	description: "Your trades and balance at a glance",
};

const DashboardPage: FC = () => <Dashboard />;

export default DashboardPage;
