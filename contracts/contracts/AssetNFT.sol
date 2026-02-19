// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IComplianceRegistry {
    function isVerified(address _account) external view returns (bool);
}

contract AssetNFT is ERC721, Ownable {
    IComplianceRegistry public complianceRegistry;
    uint256 public nextTokenId;

    mapping(uint256 => string) public tokenURIs;
    mapping(string => bool) public mintedURIs;

    // === MARKETPLACE: Listings ===
    struct Listing {
        address seller;
        uint256 price;
        bool isActive;
    }
    mapping(uint256 => Listing) public listings;

    // Events for indexer
    event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event NFTSold(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price);
    event ListingCancelled(uint256 indexed tokenId);

    constructor(address _complianceRegistry) ERC721("Fine Art Collection", "ART") Ownable(msg.sender) {
        complianceRegistry = IComplianceRegistry(_complianceRegistry);
    }

    // Override _update (OpenZeppelin v5)
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = super._update(to, tokenId, auth);
        
        // Skip compliance check for minting (from == 0) and burning (to == 0)
        if (from != address(0) && to != address(0)) {
            require(complianceRegistry.isVerified(from), "Sender not verified");
            require(complianceRegistry.isVerified(to), "Receiver not verified");
        }
        
        // Cancel listing if token is transferred
        if (listings[tokenId].isActive) {
            listings[tokenId].isActive = false;
            emit ListingCancelled(tokenId);
        }
        
        return from;
    }

    // === MINTING (Admin only) ===
    function mint(address to, string memory _uri) external onlyOwner {
        require(!mintedURIs[_uri], "NFT already minted");
        uint256 tokenId = nextTokenId++;
        _safeMint(to, tokenId);
        tokenURIs[tokenId] = _uri;
        mintedURIs[_uri] = true;
    }

    // === MARKETPLACE FUNCTIONS ===

    /// @notice List an NFT for sale (owner of NFT calls this)
    function listForSale(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(price > 0, "Price must be > 0");
        require(!listings[tokenId].isActive, "Already listed");

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            isActive: true
        });

        emit NFTListed(tokenId, msg.sender, price);
    }

    /// @notice Cancel a listing
    function cancelListing(uint256 tokenId) external {
        require(listings[tokenId].isActive, "Not listed");
        require(listings[tokenId].seller == msg.sender, "Not the seller");

        listings[tokenId].isActive = false;
        emit ListingCancelled(tokenId);
    }

    /// @notice Buy a listed NFT
    function buyNFT(uint256 tokenId) external payable {
        Listing memory listing = listings[tokenId];
        
        require(listing.isActive, "NFT not for sale");
        require(msg.value >= listing.price, "Insufficient ETH sent");
        require(complianceRegistry.isVerified(msg.sender), "Buyer not verified");

        // Mark as sold before transfer (reentrancy protection)
        listings[tokenId].isActive = false;

        // Transfer NFT from seller to buyer
        _transfer(listing.seller, msg.sender, tokenId);

        // Pay the seller
        payable(listing.seller).transfer(listing.price);

        // Refund excess ETH
        if (msg.value > listing.price) {
            payable(msg.sender).transfer(msg.value - listing.price);
        }

        emit NFTSold(tokenId, msg.sender, listing.seller, listing.price);
    }

    /// @notice Get listing info
    function getListing(uint256 tokenId) external view returns (address seller, uint256 price, bool isActive) {
        Listing memory l = listings[tokenId];
        return (l.seller, l.price, l.isActive);
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return tokenURIs[tokenId];
    }
}
