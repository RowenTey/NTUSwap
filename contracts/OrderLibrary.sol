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
        uint256 price;
        uint256 timestamp;
        address userAddress;
        OrderStatus status;
        OrderNature nature;
        uint256[] fillsPrice;
        uint256[] fillsAmount;
        uint256[] fillsTimestamp;
    }

    struct Fills {
        uint256 price;
        uint256 amount;
        uint256 timestamp;
    }

    struct AllOrdersQueryParams {
        OrderLibrary.OrderStatus status;
        address userAddress;
        bool filterByUser;
    }

    // struct PlaceOrderParams {
    //     uint8 tokenIndex1;
    //     uint8 tokenIndex2;
    //     uint256 price;
    //     uint256 amount;
    //     address userAddress;
    //     OrderLibrary.OrderType orderType;
    //     OrderLibrary.OrderNature orderNature;
    // }

    // struct PlaceOrderResults {
    //     uint256 orderId;
    //     address[] toPay;
    //     address[] toReceive;
    //     uint256[] tokenAmount;
    //     uint256[] currencyAmount;
    // }
   
}