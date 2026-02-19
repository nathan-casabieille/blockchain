/**
 * Prefer MetaMask when multiple wallets inject window.ethereum.
 * Avoids buggy extensions (e.g. evmAsk) that can throw "Unexpected error" on request/selectExtension.
 */
export function getEthereumProvider(): unknown {
  const w = typeof window !== "undefined" ? (window as any) : undefined;
  const ethereum = w?.ethereum;
  if (!ethereum) return undefined;
  const providers = ethereum.providers;
  if (Array.isArray(providers)) {
    const metamask = providers.find((p: any) => p?.isMetaMask);
    if (metamask) return metamask;
  }
  return ethereum;
}
