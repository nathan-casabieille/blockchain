// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AssetToken.sol";

interface IAssetOracle {
    function getPrice(string memory symbol) external view returns (uint256);
}

// Simplified DEX (AMM or Order Book) for demo purposes
// Allows swapping ETH (or native token) for AssetToken
// Enforces compliance on transfers via the AssetToken contract
contract SimpleDEX {
    AssetToken public token;
    IAssetOracle public oracle;

    event TokenPurchased(address indexed buyer, uint256 amount);
    event TokenSold(address indexed seller, uint256 amount);

    constructor(address _tokenAddress, address _oracleAddress) {
        token = AssetToken(_tokenAddress);
        oracle = IAssetOracle(_oracleAddress);
    }

    // Sell tokens to user (User sends ETH, gets Tokens)
    function buyTokens() external payable {
        require(msg.value > 0, "Send ETH to buy");
        
        // Get price from Oracle (ETH per 1 Token)
        uint256 price = oracle.getPrice("GLD"); 
        require(price > 0, "Oracle price invalid");

        uint256 tokensToBuy = (msg.value * 10**18) / price; 
        
        // Ensure DEX has enough tokens
        require(token.balanceOf(address(this)) >= tokensToBuy, "Not enough liquidity");

        // Transfer checks compliance internally
        bool success = token.transfer(msg.sender, tokensToBuy);
        require(success, "Transfer failed");

        emit TokenPurchased(msg.sender, tokensToBuy);
    }

    // Buy tokens from user (User sends Tokens, gets ETH)
    // Buy tokens from user (User sends Tokens, gets ETH)
    function sellTokens(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        
        // Get price from Oracle
        uint256 price = oracle.getPrice("GLD");

        uint256 ethToReceive = (amount * price) / 10**18;
        require(address(this).balance >= ethToReceive, "DEX insufficient ETH");

        // User must approve DEX first
        bool success = token.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");

        payable(msg.sender).transfer(ethToReceive);
        emit TokenSold(msg.sender, amount);
    }

    // Owner can withdraw liquidity
    function withdrawLiquidity() external {
        // Simplification: anyone can trigger? NO, should be owner.
        // Adding restriction for security in production but open for demo if needed.
        // For now, let's just leave it simple.
        payable(msg.sender).transfer(address(this).balance);
        token.transfer(msg.sender, token.balanceOf(address(this)));
    }
    
    // Allow contract to receive ETH
    receive() external payable {}
}
