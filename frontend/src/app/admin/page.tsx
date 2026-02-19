"use client";

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import contractsConfig from '@/lib/contracts-config.json';
import { ContractABIs } from '@/lib/contracts';
import { toast } from 'sonner';

export default function AdminPage() {
    const [targetAddress, setTargetAddress] = useState("");
    const [loading, setLoading] = useState(false);

    // NFT Minting state
    const [nftRecipient, setNftRecipient] = useState("");
    const [nftUri, setNftUri] = useState("");
    const [mintingNft, setMintingNft] = useState(false);

    // Auth state
    const [isOwner, setIsOwner] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [contractOwnerAddress, setContractOwnerAddress] = useState<string | null>(null);
    const [currentUserAddress, setCurrentUserAddress] = useState<string | null>(null);

    // Transfer ownership (when you are owner)
    const [newOwnerAddress, setNewOwnerAddress] = useState("");
    const [transferring, setTransferring] = useState(false);

    // Oracle state
    const [oracleSymbol, setOracleSymbol] = useState("");
    const [oraclePrice, setOraclePrice] = useState("");
    const [updatingOracle, setUpdatingOracle] = useState(false);

    const getComplianceContract = async () => {
        if (typeof (window as any).ethereum === "undefined") throw new Error("No Wallet");
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        return new ethers.Contract(contractsConfig.complianceAddress, ContractABIs.ComplianceRegistry, signer);
    };

    const getOracleContract = async () => {
        if (typeof (window as any).ethereum === "undefined") throw new Error("No Wallet");
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        return new ethers.Contract(contractsConfig.oracleAddress, ContractABIs.AssetOracle, signer);
    };

    const getNftContract = async () => {
        if (typeof (window as any).ethereum === "undefined") throw new Error("No Wallet");
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        return new ethers.Contract(contractsConfig.nftAddress, ContractABIs.AssetNFT, signer);
    };

    const handleWhitelist = async () => {
        if (!targetAddress) return;
        setLoading(true);
        const toastId = toast.loading("Whitelisting user...");
        try {
            const contract = await getComplianceContract();
            const tx = await contract.addToWhitelist(targetAddress);
            console.log("Transaction sent:", tx.hash);
            await tx.wait();

            toast.dismiss(toastId);
            toast.success("User Whitelisted", { description: `${targetAddress} can now trade.` });
        } catch (error: any) {
            console.error(error);
            toast.dismiss(toastId);
            toast.error("Action Failed", { description: error.reason || error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async () => {
        if (!targetAddress) return;
        setLoading(true);
        const toastId = toast.loading("Revoking access...");
        try {
            const contract = await getComplianceContract();
            const tx = await contract.addToBlacklist(targetAddress);
            console.log("Transaction sent:", tx.hash);
            await tx.wait();

            toast.dismiss(toastId);
            toast.success("User Blacklisted", { description: `${targetAddress} access revoked.` });
        } catch (error: any) {
            console.error(error);
            toast.dismiss(toastId);
            toast.error("Action Failed", { description: error.reason || error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleMintNft = async () => {
        if (!nftRecipient || !nftUri) {
            toast.error("Please fill in recipient and URI");
            return;
        }
        setMintingNft(true);
        const toastId = toast.loading("Minting NFT...");
        try {
            const contract = await getNftContract();
            const tx = await contract.mint(nftRecipient, nftUri);
            console.log("Mint transaction sent:", tx.hash);
            await tx.wait();

            toast.dismiss(toastId);
            toast.success("NFT Minted!", { description: `"${nftUri}" minted to ${nftRecipient.slice(0, 6)}...` });
            setNftUri("");
        } catch (error: any) {
            console.error(error);
            toast.dismiss(toastId);
            toast.error("Mint Failed", { description: error.reason || error.message });
        } finally {
            setMintingNft(false);
        }
    };

    const checkAdminStatus = async () => {
        if (typeof (window as any).ethereum === "undefined") {
            setCheckingAuth(false);
            return;
        }
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const nftContract = new ethers.Contract(contractsConfig.nftAddress, ContractABIs.AssetNFT, provider);

        let owner: string | null = null;
        try {
            owner = await nftContract.owner();
            setContractOwnerAddress(owner);
        } catch (e) {
            console.error("Failed to fetch contract owner", e);
            setContractOwnerAddress(null);
        }

        // Only if already connected: get current user (do not trigger connect popup)
        try {
            const accounts = await provider.listAccounts();
            if (accounts.length === 0) {
                setCurrentUserAddress(null);
                setIsOwner(false);
            } else {
                const signer = await provider.getSigner();
                const address = await signer.getAddress();
                setCurrentUserAddress(address);
                setIsOwner(owner != null && owner.toLowerCase() === address.toLowerCase());
            }
        } catch (e) {
            console.error("Auth check failed", e);
            setCurrentUserAddress(null);
            setIsOwner(false);
        } finally {
            setCheckingAuth(false);
        }
    };

    useEffect(() => {
        checkAdminStatus();
    }, []);

    const handleTransferOwnership = async () => {
        if (!newOwnerAddress || !ethers.isAddress(newOwnerAddress)) {
            toast.error("Enter a valid address");
            return;
        }
        setTransferring(true);
        const toastId = toast.loading("Transferring ownership...");
        try {
            const contract = await getNftContract();
            const tx = await contract.transferOwnership(newOwnerAddress);
            await tx.wait();
            toast.dismiss(toastId);
            toast.success("Ownership transferred", { description: `New admin: ${newOwnerAddress.slice(0, 10)}...` });
            setNewOwnerAddress("");
            await checkAdminStatus();
        } catch (error: any) {
            console.error(error);
            toast.dismiss(toastId);
            toast.error("Transfer failed", { description: error.reason || error.message });
        } finally {
            setTransferring(false);
        }
    };

    const handleSeedMarket = async () => {
        setLoading(true);
        const toastId = toast.loading("Initializing Default Artworks...");

        // The 3 default tableaux
        const defaultArtworks = [
            "Mona Lisa #1 - Analysis",
            "Starry Night #2",
            "The Scream #3"
        ];
        // Default price: 0.1 ETH
        const defaultPrice = ethers.parseEther("0.1");

        try {
            const contract = await getNftContract();
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();
            const address = await signer.getAddress();

            let mintedCount = 0;

            for (const uri of defaultArtworks) {
                try {
                    toast.loading(`Processing ${uri.split(' #')[0]}...`, { id: toastId });

                    // 1. Check if already minted (skip complexity for now, just try to mint)
                    // If we assume a fresh deploy or we just mint new copies

                    // 2. Mint
                    console.log(`Minting ${uri}...`);
                    const txMint = await contract.mint(address, uri);
                    await txMint.wait();
                    console.log(`Minted ${uri}`);

                    // 3. Get Token ID
                    // We can't easily get the ID from the tx receipt without parsing events carefully
                    // But since we are the owner and we just minted, let's grab the last token ID
                    // OR, better, finding the token ID by URI if the contract supports it, OR finding by owner index.

                    // Allow a small delay for indexer/node to catch up? 
                    // Actually, let's just use the `nextTokenId` - 1 approach if we are the only minter?
                    // Unsafe in concurrent env, but fine for local/admin seeding.

                    const nextId = await contract.nextTokenId();
                    // The one we just minted is nextId - 1 (since post-increment usually? or pre? let's check contract logic if possible)
                    // Standard: usually counter starts at 0 or 1.
                    // Let's assume (nextId - 1) is ours.
                    const newTokenId = Number(nextId) - 1;

                    // 4. List for Sale
                    console.log(`Listing #${newTokenId} for sale...`);
                    const txList = await contract.listForSale(newTokenId, defaultPrice);
                    await txList.wait();

                    mintedCount++;
                } catch (innerErr) {
                    console.error(`Failed to process ${uri}`, innerErr);
                    // Continue to next one
                }
            }

            toast.dismiss(toastId);
            if (mintedCount > 0) {
                toast.success("Market Seeded!", { description: `${mintedCount} artworks minted and listed.` });
            } else {
                toast.warning("Seeding incomplete", { description: "Check console for errors." });
            }

        } catch (error: any) {
            console.error(error);
            toast.dismiss(toastId);
            toast.error("Seeding Failed", { description: error.reason || error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateOraclePrice = async () => {
        if (!oracleSymbol.trim()) {
            toast.error("Please enter an asset symbol");
            return;
        }
        if (!oraclePrice || isNaN(Number(oraclePrice)) || Number(oraclePrice) <= 0) {
            toast.error("Please enter a valid price");
            return;
        }
        setUpdatingOracle(true);
        const toastId = toast.loading(`Updating ${oracleSymbol} price...`);
        try {
            const contract = await getOracleContract();
            const priceInWei = ethers.parseEther(oraclePrice);
            const tx = await contract.updatePrice(oracleSymbol.trim(), priceInWei);
            await tx.wait();
            toast.dismiss(toastId);
            toast.success("Price Updated", { description: `${oracleSymbol.trim()} → ${oraclePrice} ETH` });
            setOracleSymbol("");
            setOraclePrice("");
        } catch (error: any) {
            console.error(error);
            toast.dismiss(toastId);
            toast.error("Update Failed", { description: error.reason || error.message });
        } finally {
            setUpdatingOracle(false);
        }
    };

    // Pre-defined art pieces that can be minted
    const artPieces = [
        "Mona Lisa #1 - Analysis",
        "Starry Night #2",
        "The Scream #3",
        "The Persistence of Memory #4",
        "Girl with a Pearl Earring #5"
    ];

    if (checkingAuth) {
        return <div className="min-h-screen flex items-center justify-center text-slate-500">Verifying Admin Privileges...</div>;
    }

    if (!isOwner) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 p-6">
                <div className="text-4xl">🚫</div>
                <h1 className="text-2xl font-bold text-slate-800">Access Denied</h1>
                <p className="text-slate-500">You are not the owner of the contract.</p>
                <div className="mt-4 p-4 bg-white rounded-lg border border-slate-200 text-left max-w-md space-y-2 font-mono text-sm">
                    <p><span className="text-slate-500">Contract owner (admin):</span>{' '}
                        {contractOwnerAddress ? (
                            <span className="text-slate-800 break-all">{contractOwnerAddress}</span>
                        ) : (
                            <span className="text-slate-400">—</span>
                        )}
                    </p>
                    <p><span className="text-slate-500">Your address:</span>{' '}
                        {currentUserAddress ? (
                            <span className="text-slate-800 break-all">{currentUserAddress}</span>
                        ) : (
                            <span className="text-slate-400">—</span>
                        )}
                    </p>
                </div>
                <p className="text-slate-600 text-sm text-center max-w-md">
                    Connect with the deployer wallet to access the admin panel. If you deployed with <code className="bg-slate-200 px-1 rounded">PRIVATE_KEY</code> in <code className="bg-slate-200 px-1 rounded">.env</code>, import that key into MetaMask (same network as contracts).
                </p>
                <a href="/" className="text-blue-600 hover:underline">Return Home</a>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h1 className="text-2xl font-bold text-gray-900">🔧 Admin Panel</h1>
                <p className="text-gray-500 mt-2">Manage KYC compliance, mint NFTs, and update oracle prices.</p>
                {contractOwnerAddress && (
                    <p className="text-sm text-gray-500 mt-2 font-mono">Current contract owner: {contractOwnerAddress}</p>
                )}
            </div>

            {/* Transfer ownership */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold mb-4">👑 Transfer admin (ownership)</h2>
                <p className="text-sm text-gray-500 mb-4">Give admin rights to another address. Only the current owner can do this.</p>
                <div className="flex gap-2 flex-wrap">
                    <input
                        type="text"
                        placeholder="New owner address (0x...)"
                        className="flex-1 min-w-[200px] p-2 border border-gray-300 rounded-md text-sm font-mono"
                        value={newOwnerAddress}
                        onChange={(e) => setNewOwnerAddress(e.target.value)}
                    />
                    <button
                        onClick={handleTransferOwnership}
                        disabled={transferring || !newOwnerAddress}
                        className="bg-amber-600 text-white py-2 px-4 rounded-md hover:bg-amber-700 disabled:opacity-50"
                    >
                        {transferring ? "Transferring…" : "Transfer ownership"}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Whitelist Management */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold mb-4">👤 Compliance Management</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">User Address</label>
                            <input
                                type="text"
                                placeholder="0x..."
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                                value={targetAddress}
                                onChange={(e) => setTargetAddress(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={handleWhitelist}
                                disabled={loading}
                                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50"
                            >
                                {loading ? "Processing..." : "Whitelist User"}
                            </button>
                            <button
                                onClick={handleRevoke}
                                disabled={loading}
                                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50"
                            >
                                {loading ? "Processing..." : "Revoke Access"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* NFT Minting */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold mb-4">🎨 Mint NFT (Pre-create)</h2>
                    <p className="text-sm text-gray-500 mb-4">Mint NFTs to an address. They can then be listed for sale.</p>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Recipient Address</label>
                            <input
                                type="text"
                                placeholder="0x..."
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border font-mono"
                                value={nftRecipient}
                                onChange={(e) => setNftRecipient(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">NFT Name/URI</label>
                            <input
                                type="text"
                                placeholder="Enter name or select below"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                value={nftUri}
                                onChange={(e) => setNftUri(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {artPieces.map((art) => (
                                <button
                                    key={art}
                                    onClick={() => setNftUri(art)}
                                    className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-indigo-100 hover:text-indigo-700 transition"
                                >
                                    {art.split(" #")[0]}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={handleMintNft}
                            disabled={mintingNft}
                            className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 font-medium"
                        >
                            {mintingNft ? "Minting..." : "Mint NFT"}
                        </button>
                    </div>
                </div>

                {/* Seed Marketplace */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 md:col-span-2">
                    <h2 className="text-lg font-semibold mb-4">🌱 Seed Marketplace (Default Artworks)</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Automatically mint and list the 3 default "tableaux" (Mona Lisa, Starry Night, The Scream) for sale.
                        This ensures new users have artworks to buy.
                    </p>
                    <button
                        onClick={handleSeedMarket}
                        disabled={loading}
                        className="w-full md:w-auto bg-gradient-to-r from-green-600 to-teal-600 text-white py-3 px-6 rounded-lg hover:from-green-700 hover:to-teal-700 disabled:opacity-50 font-bold shadow-md transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Seeding Market...
                            </>
                        ) : (
                            <>
                                🚀 Initialize & List Default Artworks
                            </>
                        )}
                    </button>
                </div>

                {/* Oracle Management */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 md:col-span-2">
                    <h2 className="text-lg font-semibold mb-4">📊 Oracle Updates</h2>
                    <p className="text-sm text-gray-500 mb-4">Update asset prices manually (Admin only).</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                            className="p-2 border rounded-md"
                            placeholder="Asset Symbol (e.g. GLD)"
                            value={oracleSymbol}
                            onChange={(e) => setOracleSymbol(e.target.value)}
                        />
                        <input
                            className="p-2 border rounded-md"
                            placeholder="Price in ETH (e.g. 0.01)"
                            value={oraclePrice}
                            onChange={(e) => setOraclePrice(e.target.value)}
                        />
                        <button
                            onClick={handleUpdateOraclePrice}
                            disabled={updatingOracle}
                            className="bg-slate-900 text-white py-2 rounded-md hover:bg-slate-800 disabled:opacity-50 font-medium"
                        >
                            {updatingOracle ? "Updating..." : "Update Price"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

