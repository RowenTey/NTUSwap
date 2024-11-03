// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import "./OrderLibrary.sol";
import "./MarketManager.sol";
import "./OrderBookManager.sol";
import "./TokenManager.sol";

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
        uint256[] currencyAmount,
        uint256 timestamp
    );

    event TransferProcessed(
        address indexed from,
        address indexed to,
        uint256 tokenAmount,
        uint256 currencyAmount,
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
        uint256 newBalance = tokenManager.deposit(symbol, amount);
        
        emit DepositReceived(
            msg.sender,
            tokenManager.getTokenId(symbol),
            amount,
            block.timestamp
        );
    }

    // Function to withdraw tokens after trading
    function withdrawTokens(string memory symbol, uint256 amount) external {
        uint256 remainingBalance = tokenManager.withdraw(symbol, amount);
        
        emit WithdrawalProcessed(
            msg.sender,
            tokenManager.getTokenId(symbol),
            amount,
            block.timestamp
        );
    }


    function placeBuyOrder(
        uint8 tokenId1,
        uint8 tokenId2,
        uint256 price,
        uint256 amount,
        OrderLibrary.OrderNature orderNature
    ) external returns (uint256) {

        // Check if buyer has sufficient quote token (currency) balance
        price /= 1e18;
        amount /= 1e18;
        uint256 totalCost = price * amount;
        require(
            tokenManager.getBalance(msg.sender, tokenId2) >= totalCost,
            "Insufficient balance for buy order"
        );
        
        // Place the order through market manager
        uint256 orderId = marketManager.placeOrder(
            tokenId1,
            tokenId2,
            price,
            amount,
            msg.sender,
            OrderLibrary.OrderType.Buy,
            orderNature
        );
        
        // Try to match the order immediately
        _matchAndSettleOrder(
            marketManager.getMarketId(tokenId1, tokenId2),
            orderId,
            OrderLibrary.OrderType.Buy,
            orderNature
        );
        
        return orderId;
    }

    function placeSellOrder(
        uint8 tokenId1,
        uint8 tokenId2,
        uint256 price,
        uint256 amount,
        OrderLibrary.OrderNature orderNature
    ) external returns (uint256) {
        
        // Check if seller has sufficient base token balance
        require(
            tokenManager.getBalance(msg.sender, tokenId1) >= amount,
            "Insufficient balance for sell order"
        );

        price /= 1e18;
        amount /= 1e18;

        // Place the order through market manager
        uint256 orderId = marketManager.placeOrder(
            tokenId1,
            tokenId2,
            price,
            amount,
            msg.sender,
            OrderLibrary.OrderType.Sell,
            orderNature
        );
        
        // Try to match the order immediately
        _matchAndSettleOrder(
            marketManager.getMarketId(tokenId1, tokenId2),
            orderId,
            OrderLibrary.OrderType.Sell,
            orderNature
        );
        
        return orderId;
    }

    function _matchAndSettleOrder(
        bytes32 marketId,
        uint256 orderId,
        OrderLibrary.OrderType orderType,
        OrderLibrary.OrderNature orderNature
    ) internal {
        // Get matching results from OrderBookManager
        (
            uint256 remainingAmount,
            address[] memory toBePaid,
            address[] memory toReceive,
            uint256[] memory tokenAmount,
            uint256[] memory currencyAmount
        ) = orderBookManager.matchOrder(
            marketId,
            orderId,
            orderType,
            orderNature
        );

        // Process settlements
        for (uint256 i = 0; i < toBePaid.length; i++) {
            if (tokenAmount[i] == 0) continue; // Skips empty matches
            
            emit OrderMatched(
                marketId,
                orderType == OrderLibrary.OrderType.Buy ? orderId : i,
                orderType == OrderLibrary.OrderType.Sell ? orderId : i,
                tokenAmount[i],
                currencyAmount[i] / tokenAmount[i], // Price per token
                block.timestamp
            );
            
            // Token transfers handling
            _settleTransaction(
                marketId, 
                toBePaid[i],
                toReceive[i],
                tokenAmount[i],
                currencyAmount[i]
            );
        }

        if (tokenAmount.length > 0) {
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
        address toBePaid,
        address toReceive,
        uint256 tokenAmount,
        uint256 currencyAmount
    ) internal {
        require(toBePaid != address(0), "Invalid toBePaid address");
        require(toReceive != address(0), "Invalid toReceive address");
        require(tokenAmount > 0, "Invalid token amount");
        require(currencyAmount > 0, "Invalid currency amount");

        // Get the market details from the matched order
        (uint8 baseTokenId, uint8 quoteTokenId) = marketManager.getMarketTokens(marketId);

        // Transfer base token from seller to buyer
        bool baseTokenTransferred = tokenManager.transferFrom(
            toBePaid,  // seller
            toReceive, // buyer
            baseTokenId,
            tokenAmount
        );
        require(baseTokenTransferred, "Base token transfer failed");

        // Transfer quote token (currency) from buyer to seller
        bool quoteTokenTransferred = tokenManager.transferFrom(
            toReceive, // buyer
            toBePaid,  // seller
            quoteTokenId,
            currencyAmount
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
        OrderLibrary.OrderType orderType
    ) external {
        //Get Market Id 
        bytes32 marketId = marketManager.getMarketId(tokenId1, tokenId2);

        //Cancel Order 
        bool success = marketManager.cancelOrder(marketId, orderId, msg.sender, orderType);
        require(success, "Order could not be cancelled");

        //Emit successful cancellation event 
        emit OrderCancelled(marketId, orderId, msg.sender, orderType, block.timestamp);
    }
}