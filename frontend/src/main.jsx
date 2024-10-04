import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Web3Provider } from "./contexts/web3";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
	<StrictMode>
		<Web3Provider>
			<App />
		</Web3Provider>
	</StrictMode>
);
