// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ComplianceRegistry {
    address public owner;
    mapping(address => bool) public whitelist;
    mapping(address => bool) public blacklist;

    event AddedToWhitelist(address indexed account);
    event RemovedFromWhitelist(address indexed account);
    event AddedToBlacklist(address indexed account);
    event RemovedFromBlacklist(address indexed account);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function addToWhitelist(address _account) external onlyOwner {
        require(!blacklist[_account], "Account is blacklisted");
        whitelist[_account] = true;
        emit AddedToWhitelist(_account);
    }

    function removeFromWhitelist(address _account) external onlyOwner {
        whitelist[_account] = false;
        emit RemovedFromWhitelist(_account);
    }

    function addToBlacklist(address _account) external onlyOwner {
        blacklist[_account] = true;
        whitelist[_account] = false; // Automatically remove from whitelist
        emit AddedToBlacklist(_account);
        emit RemovedFromWhitelist(_account);
    }

    function removeFromBlacklist(address _account) external onlyOwner {
        blacklist[_account] = false;
        emit RemovedFromBlacklist(_account);
    }

    function isVerified(address _account) external view returns (bool) {
        return whitelist[_account] && !blacklist[_account];
    }
}
