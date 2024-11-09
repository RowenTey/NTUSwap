import { FC, useState, useEffect } from "react";

interface Position {
	x: number;
	y: number;
}

const GlowEffect: FC = () => {
	const [position, setPosition] = useState<Position>({ x: 0, y: 0 });

	useEffect(() => {
		const handleMouseMove = (event: MouseEvent) => {
			setPosition({ x: event.clientX, y: event.clientY });
		};

		window.addEventListener("mousemove", handleMouseMove);
		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
		};
	}, []);

	return (
		<div
			className="glow-effect"
			style={{
				transform: `translate(${position.x}px, ${position.y}px)`,
			}}
		/>
	);
};

export default GlowEffect;
