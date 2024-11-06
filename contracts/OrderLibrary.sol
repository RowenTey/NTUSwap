// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

library OrderLibrary {
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
        PartiallyFilled,
        Filled,
        Cancelled
    }

    struct Order {
        uint256 totalAmount;
        uint256 remainingAmount;
        int256 price;
        uint256 timestamp;
        address userAddress;
        OrderStatus status;
        OrderNature nature;
        int256[] fillsPrice;
        uint256[] fillsAmount;
        uint256[] fillsTimestamp;
    }

    struct Fills {
        int256 price;
        uint256 amount;
        uint256 timestamp;
    }

    struct AllOrdersQueryParams {
        OrderLibrary.OrderStatus status;
        address userAddress;
        bool filterByUser;
    }
}
