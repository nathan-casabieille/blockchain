"use client";

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { cn } from "@/lib/utils";
import contractsConfig from '@/lib/contracts-config.json';
import { ContractABIs } from '@/lib/contracts';
import { toast } from 'sonner';
import { ArrowDownUp, RefreshCw, Wallet } from 'lucide-react';
import { getEthereumProvider } from '@/lib/ethereum';

export default function TradePage() {
  const [amount, setAmount] = useState("");
  const [isBuy, setIsBuy] = useState(true);
  const [loading, setLoading] = useState(false);
  const [estimatedOut, setEstimatedOut] = useState("0.00");
  const [price, setPrice] = useState("--");
  const [balance, setBalance] = useState("--");
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [contractError, setContractError] = useState<string | null>(null);

  // Fetch Balance, Price & verification status
  const fetchMarketData = async () => {
    const providerSrc = getEthereumProvider();
    if (!providerSrc) return;
    setContractError(null);
    try {
      const provider = new ethers.BrowserProvider(providerSrc as ethers.Eip1193Provider);

      // Fetch oracle price (read-only, works without connected account)
      try {
        const oracle = new ethers.Contract(contractsConfig.oracleAddress, ContractABIs.AssetOracle, provider);
        const priceWei = await oracle.getPrice("GLD");
        setPrice(ethers.formatEther(priceWei));
      } catch {
        console.warn("Could not fetch oracle price");
      }

      const accounts = await provider.listAccounts();
      if (accounts.length === 0) return;
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const compliance = new ethers.Contract(contractsConfig.complianceAddress, ContractABIs.ComplianceRegistry, signer);
      const token = new ethers.Contract(contractsConfig.tokenAddress, ContractABIs.AssetToken, signer);

      try {
        const verified = await compliance.isVerified(address);
        setIsVerified(verified);
      } catch {
        setIsVerified(false);
      }

      if (isBuy) {
        const ethBal = await provider.getBalance(address);
        setBalance(parseFloat(ethers.formatEther(ethBal)).toFixed(4));
      } else {
        try {
          const gldBal = await token.balanceOf(address);
          setBalance(parseFloat(ethers.formatEther(gldBal)).toFixed(2));
        } catch (e: any) {
          const isBadData = e?.code === "BAD_DATA" || e?.message?.includes("could not decode");
          setBalance("0.00");
          if (isBadData) {
            setContractError("Token not available on this network. Switch to the correct chain (see config).");
          }
        }
      }
    } catch (e) {
      console.error("Trade data fetch failed", e);
      setIsVerified(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 5000);
    return () => clearInterval(interval);
  }, [isBuy]);

  // Update estimation when amount changes
  useEffect(() => {
    if (!amount || isNaN(parseFloat(amount))) {
      setEstimatedOut("0.00");
      return;
    }
    const amt = parseFloat(amount);
    if (isBuy) {
      // Paying ETH, buying GLD.
      setEstimatedOut((amt / parseFloat(price)).toFixed(4));
    } else {
      // Selling GLD, getting ETH.
      setEstimatedOut((amt * parseFloat(price)).toFixed(4));
    }
  }, [amount, isBuy, price]);

  const handleTrade = async () => {
    if (isVerified === false) {
      toast.error("Verified traders only", { description: "You must be verified to trade. Get verified on the home page." });
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    setLoading(true);
    const toastId = toast.loading("Processing Transaction...");

    try {
      const providerSrc = getEthereumProvider();
      if (!providerSrc) throw new Error("No Wallet");
      const provider = new ethers.BrowserProvider(providerSrc as ethers.Eip1193Provider);
      const signer = await provider.getSigner();
      const dexContract = new ethers.Contract(contractsConfig.dexAddress, ContractABIs.SimpleDEX, signer);

      if (isBuy) {
        const tx = await dexContract.buyTokens({ value: ethers.parseEther(amount) });
        toast.dismiss(toastId);
        toast.info("Transaction Sent", { description: "Waiting for confirmation..." });
        await tx.wait();
        toast.success("Trade Successful!", { description: `You bought ${estimatedOut} GLD` });
      } else {
        const tokenContract = new ethers.Contract(contractsConfig.tokenAddress, ContractABIs.AssetToken, signer);
        const amountWei = ethers.parseEther(amount);
        const owner = await signer.getAddress();
        const allowance = await tokenContract.allowance(owner, contractsConfig.dexAddress);

        if (allowance < (amountWei)) {
          toast.dismiss(toastId);
          toast.loading("Approving GLD...", { id: toastId });
          const approveTx = await tokenContract.approve(contractsConfig.dexAddress, amountWei);
          await approveTx.wait();
        }

        toast.loading("Swapping...", { id: toastId });
        const tx = await dexContract.sellTokens(amountWei);
        await tx.wait();
        toast.dismiss(toastId);
        toast.success("Trade Successful!", { description: `You sold ${amount} GLD for ${estimatedOut} ETH` });
      }
      setAmount("");
      fetchMarketData(); // Update balance immediately

    } catch (error: any) {
      console.error(error);
      toast.dismiss(toastId);
      toast.error("Transaction Failed", { description: error.reason || error.message || "Unknown error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-12">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 relative">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"></div>

        <div className="p-8 relative z-10">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Trade</h1>
            <div className="bg-gray-100 px-3 py-1 rounded-full text-xs font-semibold text-gray-500 flex items-center gap-2">
              <RefreshCw size={14} /> 1 GLD ≈ {price} ETH
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 transition-colors focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
              <div className="flex justify-between text-sm text-gray-500 mb-2">
                <span>You Pay</span>
                <span className="flex items-center gap-1 font-mono text-xs"><Wallet size={12} /> Balance: {balance}</span>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-transparent text-3xl font-bold text-gray-900 outline-none w-full placeholder-gray-300 relative z-10"
                  placeholder="0.0"
                />
                {/* FIX: Removed accidental text, added pointer-events-none correctly */}
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-sm font-bold text-gray-700 pointer-events-none relative z-20">
                  {isBuy ? <span className="p-1 bg-blue-100 text-blue-600 rounded">ETH</span> : <span className="p-1 bg-yellow-100 text-yellow-600 rounded">GLD</span>}
                  <span>{isBuy ? "ETH" : "GLD"}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-center -my-2 relative z-20">
              <button
                onClick={() => setIsBuy(!isBuy)}
                className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
              >
                <ArrowDownUp className="text-gray-500" size={20} />
              </button>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div className="flex justify-between text-sm text-gray-500 mb-2">
                <span>You Receive (Estimated)</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold text-gray-900 w-full truncate">
                  {estimatedOut}
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-sm font-bold text-gray-700">
                  {!isBuy ? <span className="p-1 bg-blue-100 text-blue-600 rounded">ETH</span> : <span className="p-1 bg-yellow-100 text-yellow-600 rounded">GLD</span>}
                  <span>{!isBuy ? "ETH" : "GLD"}</span>
                </div>
              </div>
            </div>

            {contractError && (
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm">
                <p className="text-amber-800 font-medium">{contractError}</p>
              </div>
            )}

            {isVerified === false && !contractError && (
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm">
                <p className="text-amber-800 font-medium">You must be verified to trade.</p>
                <p className="text-amber-700 mt-1">Get verified on the home page, then return here to swap.</p>
              </div>
            )}

            <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-100 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-blue-600/70">Rate</span>
                <span className="font-semibold text-blue-900">1 GLD = {price} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-600/70">Network Cost</span>
                <span className="font-semibold text-blue-900">~ $0.15</span>
              </div>
            </div>

            <button
              onClick={handleTrade}
              disabled={loading || isVerified === false}
              className={cn(
                "w-full py-4 rounded-xl text-lg font-bold text-white shadow-lg transition-all active:scale-[0.98]",
                loading ? "opacity-70 cursor-not-allowed" : "",
                isBuy
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25"
                  : "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 shadow-yellow-500/25",
                isVerified === false ? "opacity-60 cursor-not-allowed" : ""
              )}
            >
              {loading ? "Swapping..." : isVerified === false ? "Verified traders only" : (isBuy ? "Swap ETH to GLD" : "Swap GLD to ETH")}
            </button>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 mt-8">
        Powered by Secured RWA Protocol • Verified Compliance
      </p>
    </div>
  );
}
