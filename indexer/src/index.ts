import express from 'express';
import { ethers } from 'ethers';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import fs from 'fs';
import path from 'path';

// --- Configuration (from environment) ---
const PORT = process.env.PORT || 3001;
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

// Paths to Artifacts (Directly from contracts folder)
const ARTIFACTS_DIR = path.join(__dirname, '../../contracts/artifacts/contracts');

// --- Database Setup ---
let db: Database;

async function initDB() {
    db = await open({
        filename: './indexer.db',
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            address TEXT PRIMARY KEY,
            isWhitelisted INTEGER DEFAULT 0,
            isBlacklisted INTEGER DEFAULT 0
        );
        
        CREATE TABLE IF NOT EXISTS assets (
            symbol TEXT PRIMARY KEY,
            price TEXT
        );

        CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            buyer TEXT,
            seller TEXT,
            amount TEXT,
            price TEXT,
            timestamp INTEGER
        );
        
        CREATE TABLE IF NOT EXISTS balances (
            address TEXT,
            symbol TEXT,
            balance TEXT,
            PRIMARY KEY (address, symbol)
        );
    `);
    console.log("Database initialized");
}

// --- Blockchain Listener ---
async function startListener() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // We need contract addresses. 
    // In a real scenario, these would be in a config or fetched from a deployment file.
    // For this implementation, we will mock them or user needs to provide them after deployment.
    // For the sake of the automated plan, I'll attempt to read a 'deployed_addresses.json' if it existed,
    // Or I'll just placeholders and logic that can be initialized via API.

    console.log("Waiting for contract addresses to be set via API...");
}

// --- API ---
const app = express();
app.use(express.json());

// Enable CORS for frontend (production-ready)
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
        res.header("Access-Control-Allow-Origin", origin || "*");
    }
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Endpoint to receive contract addresses after deployment
let contracts: any = {};

app.post('/init-contracts', async (req, res) => {
    const { complianceAddress, tokenAddress, oracleAddress, dexAddress } = req.body;
    contracts = { complianceAddress, tokenAddress, oracleAddress, dexAddress };
    console.log("Contracts Initialized:", contracts);

    // Start Listening
    setupContractListeners(complianceAddress, tokenAddress, oracleAddress, dexAddress);

    res.json({ status: 'ok' });
});

async function setupContractListeners(complianceAddr: string, tokenAddr: string, oracleAddr: string, dexAddr: string) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Read ABIs
    const readAbi = (name: string, file: string) => {
        const p = path.join(ARTIFACTS_DIR, `${file}.sol/${name}.json`);
        const content = fs.readFileSync(p, 'utf-8');
        return JSON.parse(content).abi;
    };

    const complianceAbi = readAbi('ComplianceRegistry', 'ComplianceRegistry');
    const tokenAbi = readAbi('AssetToken', 'AssetToken');
    const oracleAbi = readAbi('AssetOracle', 'AssetOracle');
    const dexAbi = readAbi('SimpleDEX', 'SimpleDEX');

    const complianceContract = new ethers.Contract(complianceAddr, complianceAbi, provider);
    const tokenContract = new ethers.Contract(tokenAddr, tokenAbi, provider);
    const oracleContract = new ethers.Contract(oracleAddr, oracleAbi, provider);
    const dexContract = new ethers.Contract(dexAddr, dexAbi, provider);

    // 1. Compliance Events
    complianceContract.on('AddedToWhitelist', async (account) => {
        console.log(`Whitelist: ${account}`);
        await db.run('INSERT OR REPLACE INTO users (address, isWhitelisted, isBlacklisted) VALUES (?, 1, 0)', account);
    });

    complianceContract.on('RemovedFromWhitelist', async (account) => {
        console.log(`Removed Whitelist: ${account}`);
        await db.run('UPDATE users SET isWhitelisted = 0 WHERE address = ?', account);
    });

    // 2. Token Events (Transfer)
    tokenContract.on('Transfer', async (from, to, value) => {
        console.log(`Transfer: ${from} -> ${to} val: ${value}`);
        // Update balances (naive, relies on events, ideally should fetch from chain to be sure)
        // But for indexer, we track diffs or fetch
        // Let's fetch actual balance to be safe
        const balFrom = await tokenContract.balanceOf(from);
        const balTo = await tokenContract.balanceOf(to);
        const symbol = await tokenContract.symbol();

        if (from !== ethers.ZeroAddress) {
            await db.run('INSERT OR REPLACE INTO balances (address, symbol, balance) VALUES (?, ?, ?)', from, symbol, balFrom.toString());
        }
        if (to !== ethers.ZeroAddress) {
            await db.run('INSERT OR REPLACE INTO balances (address, symbol, balance) VALUES (?, ?, ?)', to, symbol, balTo.toString());
        }
    });

    // 3. Oracle Events
    oracleContract.on('PriceUpdated', async (symbol, price) => {
        console.log(`Price Update: ${symbol} = ${price}`);
        await db.run('INSERT OR REPLACE INTO assets (symbol, price) VALUES (?, ?)', symbol, price.toString());
    });

    // 4. DEX Events
    dexContract.on('TokenPurchased', async (buyer, amount) => {
        console.log(`Trade Buy: ${buyer} ${amount}`);
        // Record trade
        await db.run('INSERT INTO trades (buyer, amount, timestamp) VALUES (?, ?, ?)', buyer, amount.toString(), Date.now());
    });
    dexContract.on('TokenSold', async (seller, amount) => {
        console.log(`Trade Sell: ${seller} ${amount}`);
        await db.run('INSERT INTO trades (seller, amount, timestamp) VALUES (?, ?, ?)', seller, amount.toString(), Date.now());
    });

    console.log("Listeners attached!");
}

// API Endpoints for Frontend
app.get('/users/:address', async (req, res) => {
    const user = await db.get('SELECT * FROM users WHERE address = ?', req.params.address);
    res.json(user || {});
});

app.get('/balances/:address', async (req, res) => {
    const balances = await db.all('SELECT * FROM balances WHERE address = ?', req.params.address);
    res.json(balances);
});

app.get('/stats', async (req, res) => {
    const trades = await db.all('SELECT * FROM trades ORDER BY timestamp DESC LIMIT 10');
    res.json({ trades });
});

// Start Server
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Indexer running on http://localhost:${PORT}`);
    });
});
