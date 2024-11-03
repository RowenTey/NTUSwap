"use client";
import { FC } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Navbar: FC = () => {
	return (
		<nav className="sticky top-2 h-[10%] w-full flex justify-center z-[999]">
			<div className="bg-black w-[90%] rounded border-2 border-white py-1 px-3 flex justify-between text-white">
				<div className="flex gap-8">
					<div className="font-bold">NTUSwap</div>
					<ul className="flex gap-3">
						<li>Page1</li>
						<li>Page2</li>
						<li>Page3</li>
					</ul>
				</div>
				<Avatar style={{ width: "22.5px", height: "22.5px" }}>
					<AvatarImage src="https://github.com/shadcn.png" />
					<AvatarFallback>CN</AvatarFallback>
				</Avatar>
			</div>
		</nav>
	);
};

export default Navbar;
