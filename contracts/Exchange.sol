// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import "./OrderLibrary.sol";
import "./MarketManager.sol";
import "./OrderBookManager.sol";
import "./TokenManager.sol";

import "hardhat/console.sol";

contract Exchange {
    MarketManager public immutable marketManager;
    OrderBookManager public immutable orderBookManager;
    TokenManager public immutable tokenManager;

    // Events for tracking order lifecycle
    event OrderMatched(
        bytes32 indexed marketId,
        uint256 indexed buyOrderId,
        uint256 indexed sellOrderId,
        uint256 matchedAmount,
        uint256 executionPrice,
        uint256 timestamp
    );

    event SettlementCompleted(
        bytes32 indexed marketId,
        address[] toBePaid,
        address[] toReceive,
        uint256[] tokenAmount,
        int256[] currencyAmount,
        uint256 timestamp
    );

    event TransferProcessed(
        address indexed from,
        address indexed to,
        uint256 tokenAmount,
        int256 currencyAmount,
        uint256 timestamp
    );

    event DepositReceived(
        address indexed user,
        uint8 tokenId,
        uint256 amount,
        uint256 timestamp
    );

    event WithdrawalProcessed(
        address indexed user,
        uint8 tokenId,
        uint256 amount,
        uint256 timestamp
    );

    event OrderCancelled(
        bytes32 indexed marketId,
        uint256 orderId,
        address userAddress,
        OrderLibrary.OrderType orderType,
        uint256 timestamp
    );

    constructor(
        address _marketManager,
        address _orderBookManager,
        address _tokenManager
    ) {
        marketManager = MarketManager(_marketManager);
        orderBookManager = OrderBookManager(_orderBookManager);
        tokenManager = TokenManager(_tokenManager);
    }

    // Function to deposit tokens before trading
    function depositTokens(string memory symbol, uint256 amount) external {
        // First, user must have approved this contract to spend their tokens
        // This is done outside the contract using the token's approve() function

        // Perform the deposit
        uint256 newBalance = tokenManager.deposit(symbol, amount, msg.sender);

        emit DepositReceived(
            msg.sender,
            tokenManager.getTokenId(symbol),
            amount,
            block.timestamp
        );
    }

    // Function to withdraw tokens after trading
    function withdrawTokens(string memory symbol, uint256 amount) external {
        uint256 remainingBalance = tokenManager.withdraw(
            symbol,
            amount,
            msg.sender
        );

        emit WithdrawalProcessed(
            msg.sender,
            tokenManager.getTokenId(symbol),
            amount,
            block.timestamp
        );
    }

    // FIXME: Check if the order of tokens being passed is correct?
    function placeMarketOrder(
        string memory token1,
        string memory token2,
        uint256 amount,
        OrderLibrary.OrderType orderType
    ) external returns (uint256) {
        return
            orderType == OrderLibrary.OrderType.Buy
                ? placeBuyOrder(
                    token1,
                    token2,
                    0,
                    amount,
                    OrderLibrary.OrderNature.Market,
                    msg.sender
                )
                : placeSellOrder(
                    token1,
                    token2,
                    0,
                    amount,
                    OrderLibrary.OrderNature.Market,
                    msg.sender
                );
    }

    function placeLimitOrder(
        string memory token1,
        string memory token2,
        int256 price,
        uint256 amount,
        OrderLibrary.OrderType orderType
    ) external returns (uint256) {
        return
            orderType == OrderLibrary.OrderType.Buy
                ? placeBuyOrder(
                    token1,
                    token2,
                    price,
                    amount,
                    OrderLibrary.OrderNature.Limit,
                    msg.sender
                )
                : placeSellOrder(
                    token1,
                    token2,
                    price,
                    amount,
                    OrderLibrary.OrderNature.Limit,
                    msg.sender
                );
    }

    function placeBuyOrder(
        string memory token1, // want
        string memory token2, // give
        int256 price,
        uint256 amount,
        OrderLibrary.OrderNature orderNature,
        address _userAddress
    ) private returns (uint256) {
        uint8 tokenId1 = tokenManager.getTokenId(token1);
        uint8 tokenId2 = tokenManager.getTokenId(token2);

        // Check if buyer has sufficient quote token (currency) balance for a limit order
        if (orderNature == OrderLibrary.OrderNature.Limit) {
            require(
                tokenManager.getBalance(_userAddress, tokenId2) >=
                    (uint256(price) * amount) / 1 ether,
                "Insufficient balance for buy order"
            );
        }

        // Place the order through market manager
        uint256 orderId = marketManager.placeOrder(
            tokenId1,
            tokenId2,
            price,
            amount,
            _userAddress,
            OrderLibrary.OrderType.Buy,
            orderNature
        );

        uint8 exchangeTokenId = orderNature == OrderLibrary.OrderNature.Market
            ? tokenId1
            : tokenId2;

        // Try to match the order immediately
        _matchAndSettleOrder(
            marketManager.getMarketId(tokenId1, tokenId2),
            orderId,
            exchangeTokenId,
            OrderLibrary.OrderType.Buy
        );

        return orderId;
    }

    function placeSellOrder(
        string memory token1, // want
        string memory token2, // give
        int256 price,
        uint256 amount,
        OrderLibrary.OrderNature orderNature,
        address _userAddress
    ) private returns (uint256) {
        uint8 tokenId1 = tokenManager.getTokenId(token1);
        uint8 tokenId2 = tokenManager.getTokenId(token2);

        // Check if seller has sufficient base token balance for a limit order
        if (orderNature == OrderLibrary.OrderNature.Limit) {
            require(
                tokenManager.getBalance(_userAddress, tokenId2) >=
                    ((uint256(price) * amount) / 1 ether),
                "Insufficient balance for sell order"
            );
        }

        // Place the order through market manager
        uint256 orderId = marketManager.placeOrder(
            tokenId1,
            tokenId2,
            price,
            amount,
            _userAddress,
            OrderLibrary.OrderType.Sell,
            orderNature
        );

        uint8 exchangeTokenId = orderNature == OrderLibrary.OrderNature.Market
            ? tokenId2
            : tokenId1;

        // Try to match the order immediately
        _matchAndSettleOrder(
            marketManager.getMarketId(tokenId1, tokenId2),
            orderId,
            exchangeTokenId,
            OrderLibrary.OrderType.Sell
        );

        return orderId;
    }

    function _matchAndSettleOrder(
        bytes32 marketId,
        uint256 orderId,
        uint8 _exchangeTokenId,
        OrderLibrary.OrderType _orderType
    ) internal {
        // Get matching results from OrderBookManager
        (
            uint256 remainingAmount,
            address[] memory toBePaid,
            address[] memory toReceive,
            uint256[] memory tokenAmount,
            int256[] memory currencyAmount
        ) = orderBookManager.matchOrder(
                marketId,
                orderId,
                _exchangeTokenId,
                _orderType
            );

        // Process settlements
        for (uint256 i = 0; i < toBePaid.length; i++) {
            if (tokenAmount[i] == 0) continue; // Skips empty matches

            emit OrderMatched(
                marketId,
                _orderType == OrderLibrary.OrderType.Buy ? orderId : i,
                _orderType == OrderLibrary.OrderType.Sell ? orderId : i,
                tokenAmount[i],
                uint256(currencyAmount[i]) / tokenAmount[i], // Price per token
                block.timestamp
            );

            // Token transfers handling
            _settleTransaction(
                marketId,
                _exchangeTokenId,
                toBePaid[i],
                toReceive[i],
                tokenAmount[i],
                currencyAmount[i]
            );
        }

        if (tokenAmount.length > 0 && tokenAmount[0] != 0) {
            emit SettlementCompleted(
                marketId,
                toBePaid,
                toReceive,
                tokenAmount,
                currencyAmount,
                block.timestamp
            );
        }
    }

    function _settleTransaction(
        bytes32 marketId,
        uint8 exchangeTokenId,
        address toBePaid,
        address toReceive,
        uint256 tokenAmount,
        int256 currencyAmount
    ) internal {
        require(toBePaid != address(0), "Invalid toBePaid address");
        require(toReceive != address(0), "Invalid toReceive address");
        require(tokenAmount > 0, "Invalid token amount");
        require(currencyAmount > 0, "Invalid currency amount");

        // Get the market details from the matched order
        (uint8 baseTokenId, uint8 quoteTokenId) = marketManager.getMarketTokens(
            marketId
        );
        if (baseTokenId == exchangeTokenId) {
            (baseTokenId, quoteTokenId) = (quoteTokenId, baseTokenId);
        }

        // Transfer base token from seller to buyer
        bool baseTokenTransferred = tokenManager.transferFrom(
            toBePaid, // seller
            toReceive, // buyer
            baseTokenId,
            tokenAmount
        );
        require(baseTokenTransferred, "Base token transfer failed");

        // Transfer quote token (currency) from buyer to seller
        bool quoteTokenTransferred = tokenManager.transferFrom(
            toReceive, // buyer
            toBePaid, // seller
            quoteTokenId,
            uint256(currencyAmount)
        );
        require(quoteTokenTransferred, "Quote token transfer failed");

        // Emit transfer processed event
        emit TransferProcessed(
            toBePaid,
            toReceive,
            tokenAmount,
            currencyAmount,
            block.timestamp
        );
    }

    function cancelOrder(
        uint8 tokenId1,
        uint8 tokenId2,
        uint256 orderId,
        OrderLibrary.OrderType orderType,
        OrderLibrary.OrderNature orderNature
    ) external {
        // Get Market Id
        bytes32 marketId = marketManager.getMarketId(tokenId1, tokenId2);

        // Cancel Order
        bool success = marketManager.cancelOrder(
            marketId,
            orderId,
            msg.sender,
            orderType,
            orderNature
        );

        require(success, "Order could not be cancelled");

        // Emit successful cancellation event
        emit OrderCancelled(
            marketId,
            orderId,
            msg.sender,
            orderType,
            block.timestamp
        );
    }

    function getUserTokenBalance(
        address _userAddr,
        string memory _symbol
    ) external view returns (uint256) {
        return getTokenBalance(_userAddr, _symbol);
    }

    function getAllAvailableTokens()
        external
        view
        returns (string[] memory, string[] memory)
    {
        return tokenManager.getAllTokens();
    }

    function getAllUserTokenBalance(
        address _userAddr
    )
        external
        view
        returns (uint256[] memory userTokenBalances, string[] memory tokenNames)
    {
        // Retrieve all token names and symbols from the token manager
        string[] memory tokenSymbols;
        (tokenNames, tokenSymbols) = tokenManager.getAllTokens();

        // Initialize the userTokenBalances array with the correct length
        userTokenBalances = new uint256[](tokenSymbols.length);

        // Loop through each token and get the balance for the user
        for (uint256 i = 0; i < tokenSymbols.length; i++) {
            uint256 tokenBalance = getTokenBalance(_userAddr, tokenSymbols[i]);
            userTokenBalances[i] = tokenBalance;
        }

        return (userTokenBalances, tokenNames);
    }

    function getAllActiveOrdersForAMarket(
        string memory _token1,
        string memory _token2
    )
        external
        view
        returns (
            uint256[] memory amount,
            int256[] memory price,
            uint256[] memory orderIds,
            OrderLibrary.OrderType[] memory orderType,
            OrderLibrary.OrderNature[] memory nature,
            int256[][] memory fillsPrice,
            uint256[][] memory fillsAmount,
            uint256[][] memory fillsTimestamp
        )
    {
        uint8 tokenId1 = tokenManager.getTokenId(_token1);
        uint8 tokenId2 = tokenManager.getTokenId(_token2);
        bytes32 marketId = marketManager.getMarketId(tokenId1, tokenId2);

        require(
            marketManager.isMarketInitialized(tokenId1, tokenId2),
            "Market does not exist for these pairs of tokens"
        );

        return
            orderBookManager.getAllOrdersForAMarket(
                marketId,
                OrderLibrary.AllOrdersQueryParams({
                    status: OrderLibrary.OrderStatus.Active,
                    userAddress: msg.sender,
                    filterByUser: false
                })
            );
    }

    function getAllFulfilledOrdersOfAMarket(
        string memory _token1,
        string memory _token2
    )
        external
        view
        returns (
            uint256[] memory amount,
            int256[] memory price,
            uint256[] memory orderIds,
            OrderLibrary.OrderType[] memory orderType,
            OrderLibrary.OrderNature[] memory nature,
            int256[][] memory fillsPrice,
            uint256[][] memory fillsAmount,
            uint256[][] memory fillsTimestamp
        )
    {
        uint8 tokenId1 = tokenManager.getTokenId(_token1);
        uint8 tokenId2 = tokenManager.getTokenId(_token2);
        bytes32 marketId = marketManager.getMarketId(tokenId1, tokenId2);
        return
            orderBookManager.getAllOrdersForAMarket(
                marketId,
                OrderLibrary.AllOrdersQueryParams({
                    status: OrderLibrary.OrderStatus.Filled,
                    userAddress: msg.sender,
                    filterByUser: false
                })
            );
    }

    function getAllActiveUserOrdersForAMarket(
        string memory _token1,
        string memory _token2,
        address _userAddress
    )
        external
        view
        returns (
            uint256[] memory amount,
            int256[] memory price,
            uint256[] memory orderIds,
            OrderLibrary.OrderType[] memory orderType,
            OrderLibrary.OrderNature[] memory nature,
            int256[][] memory fillsPrice,
            uint256[][] memory fillsAmount,
            uint256[][] memory fillsTimestamp
        )
    {
        uint8 tokenId1 = tokenManager.getTokenId(_token1);
        uint8 tokenId2 = tokenManager.getTokenId(_token2);
        bytes32 marketId = marketManager.getMarketId(tokenId1, tokenId2);

        require(
            marketManager.isMarketInitialized(tokenId1, tokenId2),
            "Market does not exist for these pairs of tokens"
        );

        return
            orderBookManager.getAllOrdersForAMarket(
                marketId,
                OrderLibrary.AllOrdersQueryParams({
                    status: OrderLibrary.OrderStatus.Active,
                    userAddress: _userAddress,
                    filterByUser: true
                })
            );
    }

    function getAllFulfilledUserOrdersForAMarket(
        string memory _token1,
        string memory _token2,
        address _userAddress
    )
        external
        view
        returns (
            uint256[] memory amount,
            int256[] memory price,
            uint256[] memory orderIds,
            OrderLibrary.OrderType[] memory orderType,
            OrderLibrary.OrderNature[] memory nature,
            int256[][] memory fillsPrice,
            uint256[][] memory fillsAmount,
            uint256[][] memory fillsTimestamp
        )
    {
        uint8 tokenId1 = tokenManager.getTokenId(_token1);
        uint8 tokenId2 = tokenManager.getTokenId(_token2);
        bytes32 marketId = marketManager.getMarketId(tokenId1, tokenId2);
        return
            orderBookManager.getAllOrdersForAMarket(
                marketId,
                OrderLibrary.AllOrdersQueryParams({
                    status: OrderLibrary.OrderStatus.Filled,
                    userAddress: _userAddress,
                    filterByUser: true
                })
            );
    }

    function getAllCancelledUserOrdersForAMarket(
        string memory _token1,
        string memory _token2,
        address _userAddress
    )
        external
        view
        returns (
            uint256[] memory amount,
            int256[] memory price,
            uint256[] memory orderIds,
            OrderLibrary.OrderType[] memory orderType,
            OrderLibrary.OrderNature[] memory nature,
            int256[][] memory fillsPrice,
            uint256[][] memory fillsAmount,
            uint256[][] memory fillsTimestamp
        )
    {
        uint8 tokenId1 = tokenManager.getTokenId(_token1);
        uint8 tokenId2 = tokenManager.getTokenId(_token2);
        bytes32 marketId = marketManager.getMarketId(tokenId1, tokenId2);
        return
            orderBookManager.getAllOrdersForAMarket(
                marketId,
                OrderLibrary.AllOrdersQueryParams({
                    status: OrderLibrary.OrderStatus.Cancelled,
                    userAddress: _userAddress,
                    filterByUser: true
                })
            );
    }

    // Helper functions
    function getTokenBalance(
        address _userAddr,
        string memory _symbol
    ) private view returns (uint256) {
        uint8 tokenId = tokenManager.getTokenId(_symbol);
        return tokenManager.getBalance(_userAddr, tokenId);
    }
}
