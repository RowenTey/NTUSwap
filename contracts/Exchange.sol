// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "truffle/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract Exchange is Ownable {
    /* Entities */

    enum OrderType {
        Buy,
        Sell
    }

    enum OrderNature {
        Market,
        Limit
    }

    enum OrderStatus {
        Active,
        Filled,
        Cancelled
    }

    struct Order {
        uint256 amount;
        uint256 price;
        uint256 timestamp;
        address userAddress;
        OrderStatus status;
    }

    struct OrderBook {
        // Track total number of orders
        uint256 totalOrders;
        // Map orderId to Order
        mapping(uint256 => Order) orders;
        // Track number of active orders
        uint256 activeCount;
        // Queue of IDs of active orders
        uint256[] queue;
    }

    struct Market {
        // Map to buy and sell OrderBook
        mapping(OrderType => OrderBook) orderBooks;
    }

    // Map token index to ERC20 token
    mapping(uint8 => ERC20Token) tokens;
    /*
     * We can have 1 market for each combinations of buy and sell tokens
     */
    mapping(uint8 => Market) exchangeMarkets;
    // Map market index to buy and sell token index
    mapping(uint8 => uint8[]) buyToSell;
    // Map user address to user balances per token
    mapping(address => mapping(uint8 => uint256)) userBalances;

    // Track number of tokens
    uint8 tokenIndex;
    // Track number of exchange markets
    uint8 marketIndex;

    /* Events */

    event DepositEvent(
        string symbol,
        address userAddress,
        uint256 amount,
        uint256 timestamp
    );

    event WithdrawalEvent(
        string symbol,
        address userAddress,
        uint256 amount,
        uint256 timestamp
    );

    event IssueTokenEvent(
        uint8 tokenIndex,
        string name,
        string symbol,
        uint256 initialSupply,
        uint256 timestamp
    );

    event MarketCreatedEvent(
        uint256 marketIndex,
        string symbol1,
        string symbol2,
        uint256 timestamp
    );

    event OrderCreatedEvent(
        string symbol1,
        string symbol2,
        uint256 price,
        uint256 amount,
        address userAddress,
        OrderType orderType,
        OrderNature orderNature,
        uint256 timestamp
    );

    event OrderFilledEvent(
        string symbol1,
        string symbol2,
        uint256 price,
        uint256 amount,
        OrderType orderType,
        OrderNature orderNature,
        uint256 timestamp
    );

    event OrderCancelledEvent(
        uint256 orderIndex,
        string symbol1,
        string symbol2,
        OrderType orderType,
        address userAddress,
        uint256 timestamp
    );

    /* Functionalities */

    // Owner -> Issue new tokens
    function issueToken(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) public onlyOwner {
        require(!hasToken(symbol), "Token already exists");
        require(tokenIndex + 1 > tokenIndex, "Token index overflow");

        tokenIndex++;
        tokens[tokenIndex] = new ERC20Token(
            name,
            symbol,
            initialSupply,
            msg.sender
        );

        // Second token -> create market
        if (tokenIndex > 1) {
            createMarket();
        }

        emit IssueTokenEvent(
            tokenIndex,
            name,
            symbol,
            initialSupply,
            block.timestamp
        );
    }

    // Owner -> Create new market (Triggered when a new token is issued)
    // TODO: How to correctly create the exchange market?
    function createMarket() public onlyOwner {
        require(marketIndex + 1 > marketIndex, "Market index overflow");

        for (uint8 i = 1; i <= tokenIndex; i++) {
            console.log(
                "Adding market: %s and %s",
                tokens[tokenIndex].symbol(),
                tokens[i].symbol()
            );
            marketIndex++;
            buyToSell[marketIndex] = [tokenIndex, i];

            emit MarketCreatedEvent(
                marketIndex,
                tokens[tokenIndex].symbol(),
                tokens[i].symbol(),
                block.timestamp
            );
        }

        console.log("Total markets: ", marketIndex);
    }

    // User -> Transfer from wallet to contract
    function depositToken(
        string memory symbol,
        uint256 amount
    ) public returns (uint256 tokenBalance) {
        require(hasToken(symbol), "Token does not exist");
        require(amount > 0, "Amount must be greater than zero");

        uint256 userBalance = getTokenBalanceForUser(symbol);
        require(userBalance + amount > userBalance, "User balance overflow");

        uint8 symbolTokenIndex = getTokenIndex(symbol);

        // Transfer from user wallet to token balance in contract
        IERC20 token = tokens[symbolTokenIndex];
        require(
            token.transferFrom(msg.sender, address(this), amount) == true,
            "Transfer failed"
        );

        // Update ledger
        userBalances[msg.sender][symbolTokenIndex] += amount;

        emit DepositEvent(symbol, msg.sender, amount, block.timestamp);
        return userBalances[msg.sender][symbolTokenIndex];
    }

    function withdrawToken(
        string memory symbol,
        uint256 amount
    ) public returns (uint256 tokenBalance) {
        require(hasToken(symbol), "Token does not exist");
        require(amount > 0, "Amount must be greater than zero");

        uint256 userBalance = getTokenBalanceForUser(symbol);
        require(userBalance - amount >= 0, "Insufficient balance");

        uint8 symbolTokenIndex = getTokenIndex(symbol);

        // Transfer from token balance in contract to user wallet
        IERC20 token = tokens[symbolTokenIndex];
        require(token.transfer(msg.sender, amount) == true, "Transfer failed");

        // Update ledger
        userBalances[msg.sender][symbolTokenIndex] -= amount;

        emit WithdrawalEvent(symbol, msg.sender, amount, block.timestamp);
        return userBalances[msg.sender][symbolTokenIndex];
    }

    function addOrder(
        uint8 _marketIndex,
        uint256 orderId,
        OrderType orderType
    ) private {
        uint256 newOrdersCount = ++exchangeMarkets[_marketIndex]
            .orderBooks[orderType]
            .activeCount;
        uint256[] memory updatedOrdersQueue = new uint256[](newOrdersCount);
        bool isOrderAdded = false;

        if (newOrdersCount == 1) {
            updatedOrdersQueue[0] = orderId;
            isOrderAdded = true;
        } else {
            // Insert in sorted position
            Order memory newOrder = exchangeMarkets[_marketIndex]
                .orderBooks[orderType]
                .orders[orderId];
            uint256 newOrdersQueueIndex = 0;
            for (uint256 i = 0; i < newOrdersCount - 1; i++) {
                uint256 existingOrderId = exchangeMarkets[_marketIndex]
                    .orderBooks[orderType]
                    .queue[i];

                Order memory existingOrder = exchangeMarkets[_marketIndex]
                    .orderBooks[orderType]
                    .orders[existingOrderId];

                if (newOrder.price < existingOrder.price) {
                    updatedOrdersQueue[newOrdersQueueIndex++] = orderId;
                    isOrderAdded = true;
                }
                updatedOrdersQueue[newOrdersQueueIndex++] = existingOrderId;
            }
            if (!isOrderAdded)
                updatedOrdersQueue[newOrdersQueueIndex] = orderId;
        }

        exchangeMarkets[_marketIndex]
            .orderBooks[orderType]
            .queue = updatedOrdersQueue;
    }

    /*
     * BUY -> 1: buySymbol, 2: sellSymbol
     * SELL -> 1: sellSymbol, 2: buySymbol
     */
    function createOrder(
        string memory symbol1,
        string memory symbol2,
        uint256 price,
        uint256 amount,
        OrderType orderType,
        OrderNature orderNature
    ) public {
        require(hasToken(symbol1), "Token does not exist");
        require(hasToken(symbol2), "Token does not exist");
        require(price > 0, "Price must be greater than zero");
        require(amount > 0, "Amount must be greater than zero");

        uint256 balance;
        uint8 _marketIndex;
        uint8 tokenIndex1 = getTokenIndex(symbol1);
        uint8 tokenIndex2 = getTokenIndex(symbol2);

        // Check user balance depending on order type
        if (orderType == OrderType.Buy) {
            require(
                orderNature == OrderNature.Market ||
                    (orderNature == OrderNature.Limit &&
                        userBalances[msg.sender][tokenIndex1] >=
                        price * amount),
                "Insufficient balance"
            );

            _marketIndex = getMarketIndexByTokenIndex(tokenIndex1, tokenIndex2);
        } else {
            require(
                orderNature == OrderNature.Market ||
                    (orderNature == OrderNature.Limit &&
                        userBalances[msg.sender][tokenIndex2] >=
                        price * amount),
                "Insufficient balance"
            );

            _marketIndex = getMarketIndexByTokenIndex(tokenIndex2, tokenIndex1);
        }

        // Add order to order book
        uint256 _newOrderIndex = ++exchangeMarkets[_marketIndex]
            .orderBooks[orderType]
            .totalOrders;
        exchangeMarkets[_marketIndex].orderBooks[orderType].orders[
            _newOrderIndex
        ] = Order({
            amount: amount,
            price: price,
            timestamp: block.timestamp,
            userAddress: msg.sender,
            status: OrderStatus.Active
        });

        balance = fulfillOrder(
            tokenIndex1,
            tokenIndex2,
            _marketIndex,
            exchangeMarkets[_marketIndex].orderBooks[orderType].orders[
                _newOrderIndex
            ],
            orderType,
            orderNature
        );

        emit OrderCreatedEvent(
            getTokenSymbol(tokenIndex1),
            getTokenSymbol(tokenIndex2),
            price,
            amount,
            msg.sender,
            orderType,
            orderNature,
            block.timestamp
        );

        if (balance > 0 && balance < amount) {
            // Update existing order as filled
            // Create a new order for the remaining balance
            exchangeMarkets[_marketIndex]
                .orderBooks[orderType]
                .orders[_newOrderIndex]
                .status = OrderStatus.Filled;

            _newOrderIndex = ++exchangeMarkets[_marketIndex]
                .orderBooks[orderType]
                .totalOrders;
            exchangeMarkets[_marketIndex].orderBooks[orderType].orders[
                    _newOrderIndex
                ] = Order({
                amount: amount - balance,
                price: price,
                timestamp: block.timestamp,
                userAddress: msg.sender,
                status: OrderStatus.Active
            });

            emit OrderCreatedEvent(
                getTokenSymbol(tokenIndex1),
                getTokenSymbol(tokenIndex2),
                price,
                amount - balance,
                msg.sender,
                orderType,
                orderNature,
                block.timestamp
            );

            // Add to active order queue
            // TODO: Why did senior only add for LIMIT orders?
            addOrder(_marketIndex, _newOrderIndex, orderType);
        } else if (balance == 0) {
            exchangeMarkets[_marketIndex]
                .orderBooks[orderType]
                .orders[_newOrderIndex]
                .status = OrderStatus.Filled;
        } else {
            // Not filled at all
            // Add to active order queue
            // TODO: Why did senior only add for LIMIT orders?
            addOrder(_marketIndex, _newOrderIndex, orderType);
        }
    }

    /*
     * BUY -> 1: buySymbol, 2: sellSymbol
     * SELL -> 1: sellSymbol, 2: buySymbol
     */
    function fulfillOrder(
        uint8 tokenIndex1,
        uint8 tokenIndex2,
        uint8 _marketIndex,
        Order memory pendingOrder,
        OrderType orderType,
        OrderNature orderNature
    ) private returns (uint256 balance) {
        OrderType oppositeOrderType = orderType == OrderType.Buy
            ? OrderType.Sell
            : OrderType.Buy;
        uint256 oppositeOrderCount = exchangeMarkets[_marketIndex]
            .orderBooks[oppositeOrderType]
            .activeCount;
        uint256 fulfilledOrdersCount = 0;

        if (orderType == OrderType.Buy) {
            // Buy -> Match from lowest price
            for (uint256 i = 0; i < oppositeOrderCount; i++) {
                if (pendingOrder.amount == 0) break;

                uint256 orderId = exchangeMarkets[_marketIndex]
                    .orderBooks[oppositeOrderType]
                    .queue[i];

                Order memory activeOrder = exchangeMarkets[_marketIndex]
                    .orderBooks[oppositeOrderType]
                    .orders[orderId];

                // Array is sorted by price
                // -> smaller means we have matched all possible orders for a LIMIT order
                // -> we only want to buy at this price or less
                if (
                    orderNature == OrderNature.Limit &&
                    pendingOrder.price < activeOrder.price
                ) break;

                uint256 matchedAmount = Math.min(
                    pendingOrder.amount,
                    activeOrder.amount
                );

                pendingOrder.amount -= matchedAmount;
                activeOrder.amount -= matchedAmount;

                // Transfer of bought tokens
                userBalances[msg.sender][tokenIndex1] += matchedAmount;
                userBalances[activeOrder.userAddress][
                    tokenIndex2
                ] -= matchedAmount;

                // Transfer of "currency" (Bought at other's sell price)
                userBalances[msg.sender][tokenIndex2] -=
                    matchedAmount *
                    activeOrder.price;
                userBalances[activeOrder.userAddress][tokenIndex1] +=
                    matchedAmount *
                    activeOrder.price;

                if (activeOrder.amount == 0) {
                    activeOrder.status = OrderStatus.Filled;
                    fulfilledOrdersCount++;
                }

                emit OrderFilledEvent(
                    getTokenSymbol(tokenIndex1),
                    getTokenSymbol(tokenIndex2),
                    activeOrder.price,
                    matchedAmount,
                    orderType,
                    orderNature,
                    block.timestamp
                );
            }
        } else {
            // Sell -> Match from highest price
            for (uint256 i = oppositeOrderCount - 1; i >= 0; i--) {
                if (pendingOrder.amount == 0) break;

                uint256 orderId = exchangeMarkets[_marketIndex]
                    .orderBooks[oppositeOrderType]
                    .queue[i];

                Order memory activeOrder = exchangeMarkets[_marketIndex]
                    .orderBooks[oppositeOrderType]
                    .orders[orderId];

                // Array is sorted by price
                // -> bigger means we have matched all possible orders for a LIMIT order
                // -> we only want to sell at this price or more
                if (
                    orderNature == OrderNature.Limit &&
                    pendingOrder.price > activeOrder.price
                ) break;

                uint256 matchedAmount = Math.min(
                    pendingOrder.amount,
                    activeOrder.amount
                );

                pendingOrder.amount -= matchedAmount;
                activeOrder.amount -= matchedAmount;

                // Transfer of sold tokens
                userBalances[msg.sender][tokenIndex2] -= matchedAmount;
                userBalances[activeOrder.userAddress][
                    tokenIndex1
                ] += matchedAmount;

                // Transfer of "currency" (Sold at other's buy price)
                userBalances[msg.sender][tokenIndex1] +=
                    matchedAmount *
                    activeOrder.price;
                userBalances[activeOrder.userAddress][tokenIndex2] -=
                    matchedAmount *
                    activeOrder.price;

                if (activeOrder.amount == 0) {
                    activeOrder.status = OrderStatus.Filled;
                    fulfilledOrdersCount++;
                }

                emit OrderFilledEvent(
                    getTokenSymbol(tokenIndex1),
                    getTokenSymbol(tokenIndex2),
                    activeOrder.price,
                    matchedAmount,
                    orderType,
                    orderNature,
                    block.timestamp
                );
            }
        }

        updateOrderBook(
            _marketIndex,
            oppositeOrderType,
            oppositeOrderCount,
            fulfilledOrdersCount
        );

        return pendingOrder.amount;
    }

    function updateOrderBook(
        uint8 _marketIndex,
        OrderType orderType,
        uint256 currentOrderCount,
        uint256 fulfilledOrderCount
    ) private {
        uint256[] memory currentOrdersQueue = exchangeMarkets[_marketIndex]
            .orderBooks[orderType]
            .queue;

        uint256 updatedOrderCount = currentOrderCount - fulfilledOrderCount;
        uint256[] memory updatedOrdersQueue = new uint256[](updatedOrderCount);
        for (uint256 i = 0; i < currentOrderCount; i++) {
            updatedOrdersQueue[i] = currentOrdersQueue[i + fulfilledOrderCount];
        }

        exchangeMarkets[_marketIndex]
            .orderBooks[orderType]
            .queue = updatedOrdersQueue;
        exchangeMarkets[_marketIndex]
            .orderBooks[orderType]
            .activeCount = updatedOrderCount;
    }

    /*
     * BUY -> 1: buySymbol, 2: sellSymbol
     * SELL -> 1: sellSymbol, 2: buySymbol
     */
    function cancelOrder(
        string memory symbol1,
        string memory symbol2,
        OrderType orderType,
        uint256 orderId
    ) private {
        require(hasToken(symbol1), "Token does not exist");
        require(hasToken(symbol2), "Token does not exist");

        uint8 _marketIndex;
        uint8 tokenIndex1 = getTokenIndex(symbol1);
        uint8 tokenIndex2 = getTokenIndex(symbol2);

        if (orderType == OrderType.Buy) {
            _marketIndex = getMarketIndexByTokenIndex(tokenIndex1, tokenIndex2);
        } else {
            _marketIndex = getMarketIndexByTokenIndex(tokenIndex2, tokenIndex1);
        }

        uint256 currentActiveCount = exchangeMarkets[_marketIndex]
            .orderBooks[orderType]
            .activeCount;
        require(currentActiveCount > 0, "No active orders for this order type");

        bool isOrderRemoved = false;
        uint256 newQueueIndex = 0;
        uint256[] memory updatedQueue = new uint256[](currentActiveCount - 1);

        for (uint256 i = 0; i < currentActiveCount; i++) {
            if (
                exchangeMarkets[_marketIndex].orderBooks[orderType].queue[i] !=
                orderId
            ) {
                updatedQueue[newQueueIndex++] = exchangeMarkets[_marketIndex]
                    .orderBooks[orderType]
                    .queue[i];
                continue;
            }

            isOrderRemoved = true;
        }

        exchangeMarkets[_marketIndex]
            .orderBooks[orderType]
            .queue = updatedQueue;
        exchangeMarkets[_marketIndex]
            .orderBooks[orderType]
            .activeCount = newQueueIndex;

        // TODO: Do I need to refund to user?

        if (isOrderRemoved) {
            exchangeMarkets[_marketIndex]
                .orderBooks[orderType]
                .orders[orderId]
                .status = OrderStatus.Cancelled;
            emit OrderCancelledEvent(
                orderId,
                symbol1,
                symbol2,
                orderType,
                msg.sender,
                block.timestamp
            );
        }
    }

    /* Read-only utility methods */

    function hasToken(string memory symbol) public view returns (bool) {
        for (uint8 i = 0; i <= tokenIndex; i++) {
            if (
                keccak256(abi.encodePacked(tokens[i].symbol)) ==
                keccak256(abi.encodePacked(symbol))
            ) {
                return true;
            }
        }
        return false;
    }

    function getActiveOrdersForOrderBook(
        uint8 buyTokenIndex,
        uint8 sellTokenIndex,
        OrderType orderType
    ) public view returns (Order[] memory activeOrders) {
        uint8 _marketIndex = getMarketIndexByTokenIndex(buyTokenIndex, sellTokenIndex);
        uint256 currentActiveCount = exchangeMarkets[_marketIndex]
            .orderBooks[orderType]
            .activeCount;
            
        for (uint8 i = 0; i <= currentActiveCount; i++) {
            uint256 orderId = exchangeMarkets[
                _marketIndex
            ].orderBooks[orderType].queue[i];
            
            activeOrders[i] = exchangeMarkets[_marketIndex].orderBooks[orderType].orders[orderId];
        }
        
        return activeOrders;
    }

    function getTokenIndex(
        string memory symbol
    ) public view returns (uint8 foundTokenIndex) {
        for (uint8 i = 0; i <= tokenIndex; i++) {
            if (
                keccak256(bytes(tokens[i].symbol())) == keccak256(bytes(symbol))
            ) {
                return i;
            }
        }
        return 0;
    }

    function getTokenSymbol(
        uint8 tokenIndex
    ) public view returns (string memory) {
        return tokens[tokenIndex].symbol();
    }

    function getMarketIndexBySymbol(
        string memory buyTokenSymbol,
        string memory sellTokenSymbol
    ) public view returns (uint8 foundMarketIndex) {
        uint8 buyTokenIndex = getTokenIndex(buyTokenSymbol);
        uint8 sellTokenIndex = getTokenIndex(sellTokenSymbol);
        for (uint8 i = 0; i <= marketIndex; i++) {
            if (
                buyToSell[i][0] == buyTokenIndex &&
                buyToSell[i][1] == sellTokenIndex
            ) {
                return i;
            }
        }
        return 0;
    }

    function getMarketIndexByTokenIndex(
        uint8 buyTokenIndex,
        uint8 sellTokenIndex
    ) public view returns (uint8 foundMarketIndex) {
        for (uint8 i = 0; i <= marketIndex; i++) {
            if (
                buyTokenIndex == buyToSell[i][0] &&
                sellTokenIndex == buyToSell[i][1]
            ) {
                return i;
            }
        }
        return 0;
    }

    function getTokenBalanceForUser(
        string memory symbol
    ) public view returns (uint256 tokenBalance) {
        return userBalances[msg.sender][getTokenIndex(symbol)];
    }

    function getAllTokenBalanceForUser()
        public
        view
        returns (string[] memory tokenSymbol, uint256[] memory tokenBalance)
    {
        for (uint8 i = 0; i <= tokenIndex; i++) {
            tokenSymbol[i] = tokens[i].symbol();
            tokenBalance[i] = userBalances[msg.sender][i];
        }

        return (tokenSymbol, tokenBalance);
    }

    function getAllTokens() public view returns (string[] memory tokenSymbol) {
        for (uint8 i = 0; i <= tokenIndex; i++) {
            tokenSymbol[i] = tokens[i].symbol();
        }

        return tokenSymbol;
    }

    function getMarketIndex() public view returns (uint8) {
        return marketIndex;
    }

    function getAllMarkets()
        public
        view
        returns (string[] memory buySymbolName, string[] memory sellSymbolName)
    {
        for (uint8 i = 0; i <= marketIndex; i++) {
            buySymbolName[i] = tokens[buyToSell[i][0]].symbol();
            sellSymbolName[i] = tokens[buyToSell[i][1]].symbol();
        }

        return (buySymbolName, sellSymbolName);
    }
}

contract ERC20Token is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address owner
    ) ERC20(name, symbol) {
        _mint(owner, initialSupply);
    }
}
