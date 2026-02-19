// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AssetOracle {
    address public owner;
    mapping(string => uint256) public assetPrices; // Symbol -> Price (in USD, 18 decimals)

    event PriceUpdated(string symbol, uint256 price);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function updatePrice(string memory symbol, uint256 price) external onlyOwner {
        assetPrices[symbol] = price;
        emit PriceUpdated(symbol, price);
    }

    function getPrice(string memory symbol) external view returns (uint256) {
        return assetPrices[symbol];
    }
}
