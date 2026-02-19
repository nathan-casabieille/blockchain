// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IComplianceRegistry {
    function isVerified(address _account) external view returns (bool);
}

// Minimal ERC20 implementation with compliance check
contract AssetToken {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    IComplianceRegistry public complianceRegistry;
    address public owner;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, address _complianceRegistry) {
        name = _name;
        symbol = _symbol;
        complianceRegistry = IComplianceRegistry(_complianceRegistry);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // Checking compliance before transfer
    function _beforeTokenTransfer(address from, address to) internal view {
        if (from != address(0)) { // Minting doesn't require sender check (usually admin)
            require(complianceRegistry.isVerified(from), "Sender not verified");
        }
        if (to != address(0)) { // Burning doesn't require receiver check
            require(complianceRegistry.isVerified(to), "Receiver not verified");
        }
    }

    function transfer(address to, uint256 value) external returns (bool) {
        require(balanceOf[msg.sender] >= value, "Insufficient balance");
        _beforeTokenTransfer(msg.sender, to);
        
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        require(balanceOf[from] >= value, "Insufficient balance");
        require(allowance[from][msg.sender] >= value, "Insufficient allowance");
        
        _beforeTokenTransfer(from, to);

        allowance[from][msg.sender] -= value;
        balanceOf[from] -= value;
        balanceOf[to] += value;
        
        emit Transfer(from, to, value);
        return true;
    }

    function mint(address to, uint256 value) external onlyOwner {
        require(complianceRegistry.isVerified(to), "Receiver not verified");
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }
}
