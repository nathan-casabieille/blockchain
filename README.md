# Tokenized Asset Management Platform

A decentralized platform for tokenizing Real-World Assets (RWAs) with built-in compliance (KYC), on-chain trading (DEX), and real-time indexing.

## Features

- **Real-World Asset Tokenization**: ERC20/ERC721 tokens representing assets.
- **Compliance (KYC)**: On-chain whitelist ensures only verified users can trade/hold tokens.
- **On-Chain Trading**: Simple Liquidity Pool / DEX integration.
- **Oracle**: Simple on-chain oracle for asset pricing.
- **Real-Time Indexer**: Node.js service syncing blockchain events to a database/frontend.
- **Modern UI**: Next.js dashboard with wallet connection.

## Tech Stack

- **Blockchain**: EVM (Hardhat, Solidity).
- **Frontend**: Next.js, TypeScript, Tailwind CSS, Ethers.js.
- **Indexer**: Node.js, Express, Ethers.js, SQLite.

## Justification of Blockchain Choice (EVM)

We chose an **EVM-compatible architecture** (Hardhat/Ethereum) for the following reasons:
1.  **Robust Tooling**: The availability of mature tools like Hardhat and Ethers.js accelerates development and testing compared to XRPL.
2.  **Smart Contract Flexibility**: Solidity allows for complex, custom logic (e.g., specific KYC constraints in `_beforeTokenTransfer`) that might be harder to implement with standard XRPL primitives.
3.  **Industry Standard**: EVM is the dominant standard in DeFi, making the skills and code more portable.

## Prerequisites

- Node.js (v18+)
- NPM
- MetaMask Wallet (for browser interaction)

## Getting Started

### 1. Installation

```bash
# Install dependencies for all services
cd contracts && npm install
cd ../indexer && npm install
cd ../frontend && npm install
```

### 2. Smart Contracts (Local / Hardhat)

```bash
cd contracts

# Compile contracts
npx hardhat compile

# Deploy to local Hardhat Network
npx hardhat run scripts/deploy.ts --network localhost

# OR Start local node (and deploy manually)
npx hardhat node
```

> **Note**: After deployment, copy the contract addresses output to use in the Indexer/Frontend configuration.

### 3. Indexer Service

```bash
cd indexer

# Start the indexer (ensure local node is running)
npm run dev
```

The indexer runs on `http://localhost:3001`.

### 4. Frontend

```bash
cd frontend

# Start development server
npm run dev
```

Open `http://localhost:3000` in your browser.

## Architecture Decisions

- **ComplianceRegistry**: Separated logic for KYC to allow updating rules without redeploying token contracts.
- **Indexer**: Uses SQLite for lightweight, fast queries. Polls local node for events.
- **Monorepo**: Keeps all code in one place for easier development.
