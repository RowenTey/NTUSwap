import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function toCamelCase(str: string): string {
	return str
		.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) =>
			index === 0 ? match.toLowerCase() : match.toUpperCase()
		)
		.replace(/\s+/g, "");
}

export function formatAddress(address: string): string {
	if (address.length <= 10) {
		return address;
	}

	const firstPart = address.slice(0, 5);
	const lastPart = address.slice(-5);
	return `${firstPart}...${lastPart}`;
}
