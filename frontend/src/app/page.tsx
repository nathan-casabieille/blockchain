"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { ethers } from 'ethers';
import { cn } from "@/lib/utils";
import contractsConfig from '@/lib/contracts-config.json';
import { ContractABIs } from '@/lib/contracts';
import { toast } from 'sonner';
import { PriceChart } from '@/components/PriceChart';
import staticPriceData from '@/data/static-price-data.json';
import { getEthereumProvider } from '@/lib/ethereum';

type ActivityEvent = {
    id: string;
    type: 'transfer' | 'buy' | 'sell' | 'mint';
    from: string;
    to: string;
    amount: string;
    timestamp: number;
    txHash: string;
};

const TYPE_CONFIG = {
    mint:     { label: 'MINT',     bg: 'bg-purple-100', text: 'text-purple-700' },
    buy:      { label: 'BUY',      bg: 'bg-green-100',  text: 'text-green-700'  },
    sell:     { label: 'SELL',     bg: 'bg-red-100',    text: 'text-red-700'    },
    transfer: { label: 'TRANSFER', bg: 'bg-blue-100',   text: 'text-blue-700'   },
} as const;

function truncateAddr(addr: string) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function Home() {
    const [balance, setBalance] = useState("0");
    const [ethBalance, setEthBalance] = useState("0");
    const [isWhitelisted, setIsWhitelisted] = useState(false);
    const [loading, setLoading] = useState(true);

    // Market Data (fetched from oracle)
    const [goldPrice, setGoldPrice] = useState("--");

    // Transfer State
    const [recipient, setRecipient] = useState("");
    const [transferAmount, setTransferAmount] = useState("");
    const [transferLoading, setTransferLoading] = useState(false);

    // Live activity from chain
    const [activities, setActivities] = useState<ActivityEvent[]>([]);
    const [chainConnected, setChainConnected] = useState(false);
    const lastBlockRef = useRef<number>(0);

    const fetchData = async () => {
        const providerSrc = getEthereumProvider();
        if (!providerSrc) {
            setLoading(false);
            return;
        }
        try {
            const provider = new ethers.BrowserProvider(providerSrc as ethers.Eip1193Provider);

            // Fetch oracle price (read-only, works without connected account)
            try {
                const oracle = new ethers.Contract(contractsConfig.oracleAddress, ContractABIs.AssetOracle, provider);
                const priceWei = await oracle.getPrice("GLD");
                setGoldPrice(ethers.formatEther(priceWei));
            } catch {
                console.warn("Could not fetch oracle price");
            }

            const accounts = await provider.listAccounts();
            if (accounts.length === 0) {
                setLoading(false);
                return;
            }
            const signer = await provider.getSigner();
            const address = await signer.getAddress();

            const compliance = new ethers.Contract(contractsConfig.complianceAddress, ContractABIs.ComplianceRegistry, signer);
            const token = new ethers.Contract(contractsConfig.tokenAddress, ContractABIs.AssetToken, signer);

            const [verifiedResult, tokenBalanceResult, ethBalResult] = await Promise.allSettled([
                compliance.isVerified(address),
                token.balanceOf(address),
                provider.getBalance(address)
            ]);

            if (verifiedResult.status === "fulfilled") setIsWhitelisted(verifiedResult.value);
            if (tokenBalanceResult.status === "fulfilled") {
                setBalance(ethers.formatEther(tokenBalanceResult.value));
            } else {
                setBalance("0");
                if (tokenBalanceResult.reason?.code === "BAD_DATA" || tokenBalanceResult.reason?.message?.includes("could not decode")) {
                    console.warn("Token balance not available on this network (wrong chain or contract not deployed).");
                }
            }
            if (ethBalResult.status === "fulfilled") setEthBalance(ethers.formatEther(ethBalResult.value));
        } catch (err) {
            console.error("Dashboard fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchLiveActivity = useCallback(async () => {
        const providerSrc = getEthereumProvider();
        if (!providerSrc) {
            setChainConnected(false);
            return;
        }
        try {
            const provider = new ethers.BrowserProvider(providerSrc as ethers.Eip1193Provider);
            const currentBlock = await provider.getBlockNumber();

            // First call: look back 500 blocks. Subsequent: only new blocks.
            const fromBlock = lastBlockRef.current > 0
                ? lastBlockRef.current + 1
                : Math.max(0, currentBlock - 500);

            if (fromBlock > currentBlock) {
                setChainConnected(true);
                return;
            }

            const token = new ethers.Contract(contractsConfig.tokenAddress, ContractABIs.AssetToken, provider);
            const dex = new ethers.Contract(contractsConfig.dexAddress, ContractABIs.SimpleDEX, provider);

            const [transfers, buys, sells] = await Promise.all([
                token.queryFilter(token.filters.Transfer(), fromBlock, currentBlock),
                dex.queryFilter(dex.filters.TokenPurchased(), fromBlock, currentBlock),
                dex.queryFilter(dex.filters.TokenSold(), fromBlock, currentBlock),
            ]);

            // Get block timestamps for unique block numbers
            const allEvents = [...transfers, ...buys, ...sells];
            const uniqueBlocks = [...new Set(allEvents.map(e => e.blockNumber))];
            const blockTimestamps: Record<number, number> = {};
            await Promise.all(
                uniqueBlocks.map(async (bn) => {
                    const block = await provider.getBlock(bn);
                    if (block) blockTimestamps[bn] = block.timestamp * 1000;
                })
            );

            const newEvents: ActivityEvent[] = [];

            for (const e of transfers) {
                const log = e as ethers.EventLog;
                const from = log.args[0] as string;
                const to = log.args[1] as string;
                const isMint = from === ethers.ZeroAddress;
                // Skip transfers that are part of DEX operations to avoid duplicates
                const isDexTransfer = from.toLowerCase() === contractsConfig.dexAddress.toLowerCase()
                    || to.toLowerCase() === contractsConfig.dexAddress.toLowerCase();
                if (isDexTransfer) continue;

                newEvents.push({
                    id: `${log.transactionHash}-${log.index}`,
                    type: isMint ? 'mint' : 'transfer',
                    from, to,
                    amount: ethers.formatEther(log.args[2]),
                    timestamp: blockTimestamps[log.blockNumber] || Date.now(),
                    txHash: log.transactionHash,
                });
            }

            for (const e of buys) {
                const log = e as ethers.EventLog;
                newEvents.push({
                    id: `${log.transactionHash}-${log.index}`,
                    type: 'buy',
                    from: log.args[0] as string,
                    to: contractsConfig.dexAddress,
                    amount: ethers.formatEther(log.args[1]),
                    timestamp: blockTimestamps[log.blockNumber] || Date.now(),
                    txHash: log.transactionHash,
                });
            }

            for (const e of sells) {
                const log = e as ethers.EventLog;
                newEvents.push({
                    id: `${log.transactionHash}-${log.index}`,
                    type: 'sell',
                    from: log.args[0] as string,
                    to: contractsConfig.dexAddress,
                    amount: ethers.formatEther(log.args[1]),
                    timestamp: blockTimestamps[log.blockNumber] || Date.now(),
                    txHash: log.transactionHash,
                });
            }

            lastBlockRef.current = currentBlock;

            if (newEvents.length > 0) {
                setActivities((prev: ActivityEvent[]) => {
                    const merged = [...newEvents, ...prev];
                    const seen = new Set<string>();
                    const unique = merged.filter(e => {
                        if (seen.has(e.id)) return false;
                        seen.add(e.id);
                        return true;
                    });
                    unique.sort((a, b) => b.timestamp - a.timestamp);
                    return unique.slice(0, 20);
                });
            }
            setChainConnected(true);
        } catch (err) {
            console.error("Live activity fetch error:", err);
            setChainConnected(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        fetchLiveActivity();
        const interval = setInterval(() => {
            fetchData();
            fetchLiveActivity();
        }, 5000);
        return () => clearInterval(interval);
    }, [fetchLiveActivity]);

    const handleTransfer = async () => {
        if (!recipient || !transferAmount) {
            toast.error("Please fill in all fields");
            return;
        }
        setTransferLoading(true);
        const toastId = toast.loading("Processing Transfer...");

        try {
            const providerSrc = getEthereumProvider();
            if (!providerSrc) throw new Error("No wallet");
            const provider = new ethers.BrowserProvider(providerSrc as ethers.Eip1193Provider);
            const signer = await provider.getSigner();
            const token = new ethers.Contract(contractsConfig.tokenAddress, ContractABIs.AssetToken, signer);

            const tx = await token.transfer(recipient, ethers.parseEther(transferAmount));
            await tx.wait();

            toast.dismiss(toastId);
            toast.success("Transfer Successful!", { description: `Sent ${transferAmount} GLD to ${recipient.slice(0, 6)}...` });

            setRecipient("");
            setTransferAmount("");
            fetchData();
        } catch (error: any) {
            console.error(error);
            toast.dismiss(toastId);
            toast.error("Transfer Failed", { description: error.reason || error.message });
        } finally {
            setTransferLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* 🚀 MARKET TICKER */}
            <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg border border-slate-800">
                {/* ... existing ticker content ... */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-yellow-500/20 p-2 rounded-lg">
                            <span className="text-2xl">🥇</span>
                        </div>
                        <div>
                            <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Gold (GLD) Price</p>
                            <p className="text-xl font-mono font-bold text-yellow-500">
                                {goldPrice} ETH <span className="text-xs text-slate-500">/ 1 GLD</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 border-l border-slate-700 pl-4">
                        <div className="bg-purple-500/20 p-2 rounded-lg">
                            <span className="text-2xl">🖼️</span>
                        </div>
                        <div>
                            <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Art Floor Price</p>
                            <p className="text-xl font-mono font-bold text-purple-400">
                                {staticPriceData.artFloor} ETH
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 border-l border-slate-700 pl-4 pr-4">
                        <div>
                            <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Market Status</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                </span>
                                <span className="text-sm font-bold text-green-400">LIVE</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 📈 PRICE CHART */}
            <PriceChart currentPrice={goldPrice} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Compliance Card */}
                <div className={cn(
                    "p-6 rounded-xl shadow-sm border transition-all",
                    isWhitelisted ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                )}>
                    <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Account Status</h2>
                    <div className="mt-4 flex items-center gap-3">
                        <div className={cn("w-3 h-3 rounded-full", isWhitelisted ? "bg-green-500" : "bg-red-500")} />
                        <span className={cn("text-xl font-bold", isWhitelisted ? "text-green-700" : "text-red-700")}>
                            {isWhitelisted ? 'Verified Trader' : 'Unverified'}
                        </span>
                    </div>
                </div>

                {/* Portfolio Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Your Portfolio</h2>
                    <div className="mt-4 space-y-2">
                        <div className="flex justify-between items-end border-b border-gray-50 pb-2">
                            <span className="text-gray-500">Gold Holdings</span>
                            <span className="font-bold text-xl text-yellow-600">{parseFloat(balance).toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-sm text-gray-400">GLD</span></span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-gray-500">ETH Balance</span>
                            <span className="font-bold text-lg">{parseFloat(ethBalance).toFixed(4)} <span className="text-sm text-gray-400">ETH</span></span>
                        </div>
                    </div>
                </div>

                {/* Actions Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center gap-3">
                    <a href="/trade" className="w-full text-center py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 hover:shadow-lg transition-all">
                        🚀 Trade GLD
                    </a>
                    <a href="/gallery" className="w-full text-center py-3 bg-white border-2 border-indigo-100 text-indigo-600 font-bold rounded-lg hover:border-indigo-600 hover:bg-indigo-50 transition-all">
                        🎨 View Gallery
                    </a>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Transfer Section */}
                <section className="col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span>💸</span> Quick Transfer
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-gray-500 font-medium">RECIPIENT</label>
                            <input
                                type="text"
                                placeholder="0x..."
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm relative z-10"
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 font-medium">AMOUNT (GLD)</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold relative z-10 min-w-0"
                                    value={transferAmount}
                                    onChange={(e) => setTransferAmount(e.target.value)}
                                />
                                <button
                                    onClick={handleTransfer}
                                    disabled={transferLoading}
                                    className="bg-slate-900 text-white px-4 py-3 rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
                                >
                                    {transferLoading ? "..." : "Send"}
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Live Market Section */}
                <section className="col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <span>📊</span> Live Market Activity
                        </h2>
                        <span className={cn(
                            "text-xs font-mono px-2 py-1 rounded border",
                            chainConnected
                                ? "text-green-600 bg-green-50 border-green-100"
                                : "text-red-600 bg-red-50 border-red-100"
                        )}>
                            {chainConnected ? "● On-chain" : "● Disconnected"}
                        </span>
                    </div>

                    <div className="overflow-hidden">
                        {activities.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                <p className="text-gray-400 italic">
                                    {chainConnected ? "No activity yet on this chain" : "Connect wallet to see live activity"}
                                </p>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-medium">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Type</th>
                                        <th className="px-4 py-3 text-left">From / To</th>
                                        <th className="px-4 py-3 text-right">Amount</th>
                                        <th className="px-4 py-3 text-right">Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {activities.map((event: ActivityEvent) => {
                                        const cfg = TYPE_CONFIG[event.type];
                                        return (
                                            <tr key={event.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <span className={cn("px-2 py-1 rounded text-xs font-bold", cfg.bg, cfg.text)}>
                                                        {cfg.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                                                    {event.type === 'mint' ? (
                                                        <span>→ {truncateAddr(event.to)}</span>
                                                    ) : (
                                                        <span>{truncateAddr(event.from)} → {truncateAddr(event.to)}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-medium">
                                                    {parseFloat(event.amount).toFixed(2)} GLD
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-400 text-sm">
                                                    {new Date(event.timestamp).toLocaleTimeString()}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
