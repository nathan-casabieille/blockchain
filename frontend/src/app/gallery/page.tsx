"use client";

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { cn } from "@/lib/utils";
import contractsConfig from '@/lib/contracts-config.json';
import { ContractABIs } from '@/lib/contracts';
import { toast } from 'sonner';

// Mock Metadata for demo - maps URI to image
const ART_IMAGES: Record<string, string> = {
    "Mona Lisa #1 - Analysis": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg/800px-Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg",
    "Starry Night #2": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/1200px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg",
    "The Scream #3": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Edvard_Munch%2C_1893%2C_The_Scream%2C_oil%2C_tempera_and_pastel_on_cardboard%2C_91_x_73.5_cm%2C_National_Gallery_of_Norway.jpg/800px-Edvard_Munch%2C_1893%2C_The_Scream%2C_oil%2C_tempera_and_pastel_on_cardboard%2C_91_x_73.5_cm%2C_National_Gallery_of_Norway.jpg"
};

type NFT = {
    id: number;
    uri: string;
    owner: string;
    listing?: {
        seller: string;
        price: bigint;
        isActive: boolean;
    };
};

export default function GalleryPage() {
    const [allNfts, setAllNfts] = useState<NFT[]>([]);
    const [myNfts, setMyNfts] = useState<NFT[]>([]);
    const [listedNfts, setListedNfts] = useState<NFT[]>([]);
    const [loading, setLoading] = useState(true);
    const [buying, setBuying] = useState<number | null>(null);
    const [listing, setListing] = useState<number | null>(null);
    const [listPrice, setListPrice] = useState("");
    const [transferringId, setTransferringId] = useState<number | null>(null);
    const [recipient, setRecipient] = useState("");
    const [currentAddress, setCurrentAddress] = useState("");

    const fetchAllNFTs = async () => {
        if (typeof (window as any).ethereum === "undefined") return;
        try {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const accounts = await provider.listAccounts();
            if (accounts.length === 0) {
                setLoading(false);
                return;
            }
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            setCurrentAddress(address.toLowerCase());

            const nftContract = new ethers.Contract(contractsConfig.nftAddress, ContractABIs.AssetNFT, signer);

            const nextId = await nftContract.nextTokenId();
            const totalTokens = Number(nextId);

            const items: NFT[] = [];
            const mine: NFT[] = [];
            const listed: NFT[] = [];

            for (let i = 0; i < totalTokens; i++) {
                try {
                    const owner = await nftContract.ownerOf(i);
                    const uri = await nftContract.tokenURI(i);
                    const [seller, price, isActive] = await nftContract.getListing(i);

                    const nft: NFT = {
                        id: i,
                        uri,
                        owner: owner.toLowerCase(),
                        listing: {
                            seller: seller.toLowerCase(),
                            price: price,
                            isActive
                        }
                    };

                    items.push(nft);

                    if (owner.toLowerCase() === address.toLowerCase()) {
                        mine.push(nft);
                    }

                    if (isActive) {
                        listed.push(nft);
                    }
                } catch (e) {
                    // Token doesn't exist
                }
            }

            setAllNfts(items);
            setMyNfts(mine);
            setListedNfts(listed);
        } catch (err) {
            console.error("NFT Fetch error", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllNFTs();
    }, []);

    const handleBuy = async (tokenId: number, price: bigint) => {
        setBuying(tokenId);
        const toastId = toast.loading("Purchasing NFT...");
        try {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(contractsConfig.nftAddress, ContractABIs.AssetNFT, signer);

            const tx = await contract.buyNFT(tokenId, { value: price });
            await tx.wait();

            toast.dismiss(toastId);
            toast.success("NFT Purchased!", { description: `You now own NFT #${tokenId}` });
            fetchAllNFTs();
        } catch (error: any) {
            console.error(error);
            toast.dismiss(toastId);
            toast.error("Purchase Failed", { description: error.reason || error.message });
        } finally {
            setBuying(null);
        }
    };

    const handleListForSale = async (tokenId: number) => {
        if (!listPrice || parseFloat(listPrice) <= 0) {
            toast.error("Please enter a valid price");
            return;
        }

        const toastId = toast.loading("Listing NFT for sale...");
        try {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(contractsConfig.nftAddress, ContractABIs.AssetNFT, signer);

            const priceWei = ethers.parseEther(listPrice);
            const tx = await contract.listForSale(tokenId, priceWei);
            await tx.wait();

            toast.dismiss(toastId);
            toast.success("NFT Listed!", { description: `NFT #${tokenId} is now for sale at ${listPrice} ETH` });
            setListing(null);
            setListPrice("");
            fetchAllNFTs();
        } catch (error: any) {
            console.error(error);
            toast.dismiss(toastId);
            toast.error("Listing Failed", { description: error.reason || error.message });
        }
    };

    const handleCancelListing = async (tokenId: number) => {
        const toastId = toast.loading("Cancelling listing...");
        try {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(contractsConfig.nftAddress, ContractABIs.AssetNFT, signer);

            const tx = await contract.cancelListing(tokenId);
            await tx.wait();

            toast.dismiss(toastId);
            toast.success("Listing Cancelled");
            fetchAllNFTs();
        } catch (error: any) {
            console.error(error);
            toast.dismiss(toastId);
            toast.error("Cancel Failed", { description: error.reason || error.message });
        }
    };

    const handleTransfer = async (tokenId: number) => {
        if (!recipient) {
            toast.error("Please enter a recipient address");
            return;
        }
        const toastId = toast.loading(`Transferring #${tokenId}...`);
        try {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            const contract = new ethers.Contract(contractsConfig.nftAddress, ContractABIs.AssetNFT, signer);

            const tx = await contract.transferFrom(address, recipient, tokenId);
            await tx.wait();

            toast.dismiss(toastId);
            toast.success("Transfer Successful", { description: `NFT #${tokenId} sent to ${recipient.slice(0, 6)}...` });

            setTransferringId(null);
            setRecipient("");
            fetchAllNFTs();
        } catch (error: any) {
            console.error(error);
            toast.dismiss(toastId);
            toast.error("Transfer Failed", { description: error.reason || error.message });
        }
    };

    const getImageForUri = (uri: string) => {
        return ART_IMAGES[uri] || `https://placehold.co/400x400/1a1a2e/ffffff?text=${encodeURIComponent(uri.split(' ')[0])}`;
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h1 className="text-3xl font-bold text-gray-900">🎨 NFT Marketplace</h1>
                <p className="text-gray-500 mt-2">Buy and sell tokenized art. All NFTs are pre-minted by admins.</p>
            </div>

            {/* NFTs For Sale */}
            <section>
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span>🛒</span> NFTs For Sale
                </h2>
                {loading ? (
                    <p className="text-gray-500">Loading marketplace...</p>
                ) : listedNfts.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        No NFTs currently for sale. Check back later!
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {listedNfts.map((nft) => (
                            <div key={nft.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition group">
                                <div className="aspect-square bg-gray-200 relative">
                                    <img
                                        src={getImageForUri(nft.uri)}
                                        alt={nft.uri}
                                        className="w-full h-full object-cover"
                                    />
                                    {nft.owner !== currentAddress && (
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                            <button
                                                onClick={() => handleBuy(nft.id, nft.listing!.price)}
                                                disabled={buying === nft.id}
                                                className="bg-green-500 text-white px-6 py-3 rounded-full font-bold hover:bg-green-600 hover:scale-105 transition shadow-lg"
                                            >
                                                {buying === nft.id ? "Processing..." : `Buy for ${ethers.formatEther(nft.listing!.price)} ETH`}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4">
                                    <h3 className="font-bold text-lg truncate">{nft.uri}</h3>
                                    <p className="text-sm text-gray-500">Token ID: #{nft.id}</p>
                                    <div className="mt-2 flex justify-between items-center">
                                        <span className="text-green-600 font-bold">{ethers.formatEther(nft.listing!.price)} ETH</span>
                                        <span className="text-xs text-gray-400">by {nft.listing!.seller.slice(0, 6)}...</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* My NFTs */}
            <section>
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span>🖼️</span> My Collection
                </h2>
                {loading ? (
                    <p className="text-gray-500">Loading your collection...</p>
                ) : myNfts.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        You don't own any NFTs yet. Buy one above!
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {myNfts.map((nft) => (
                            <div key={nft.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition">
                                <div className="aspect-square bg-gray-200 relative">
                                    <img
                                        src={getImageForUri(nft.uri)}
                                        alt={nft.uri}
                                        className="w-full h-full object-cover"
                                    />
                                    {nft.listing?.isActive && (
                                        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                                            Listed
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 space-y-3">
                                    <div>
                                        <h3 className="font-bold text-lg truncate">{nft.uri}</h3>
                                        <p className="text-sm text-gray-500">Token ID: #{nft.id}</p>
                                    </div>

                                    {nft.listing?.isActive ? (
                                        <div className="space-y-2">
                                            <p className="text-sm text-green-600 font-medium">On sale for {ethers.formatEther(nft.listing.price)} ETH</p>
                                            <button
                                                onClick={() => handleCancelListing(nft.id)}
                                                className="w-full py-2 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition font-medium"
                                            >
                                                Cancel Listing
                                            </button>
                                        </div>
                                    ) : listing === nft.id ? (
                                        <div className="space-y-2">
                                            <input
                                                type="number"
                                                placeholder="Price in ETH"
                                                value={listPrice}
                                                onChange={(e) => setListPrice(e.target.value)}
                                                className="w-full p-2 text-sm border rounded-lg"
                                                step="0.001"
                                                min="0"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleListForSale(nft.id)}
                                                    className="flex-1 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                                                >
                                                    Confirm
                                                </button>
                                                <button
                                                    onClick={() => { setListing(null); setListPrice(""); }}
                                                    className="flex-1 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : transferringId === nft.id ? (
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                placeholder="Recipient 0x..."
                                                value={recipient}
                                                onChange={(e) => setRecipient(e.target.value)}
                                                className="w-full p-2 text-sm border rounded-lg font-mono"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleTransfer(nft.id)}
                                                    className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                                                >
                                                    Send
                                                </button>
                                                <button
                                                    onClick={() => { setTransferringId(null); setRecipient(""); }}
                                                    className="flex-1 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setListing(nft.id)}
                                                className="flex-1 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                                            >
                                                Sell
                                            </button>
                                            <button
                                                onClick={() => setTransferringId(nft.id)}
                                                className="flex-1 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
                                            >
                                                Transfer
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
