import { ethers } from "hardhat";
const fs = require('fs');
const path = require('path');

async function main() {
    // Read config
    const configPath = path.join(__dirname, "../../frontend/src/lib/contracts-config.json");
    if (!fs.existsSync(configPath)) {
        console.error("Config not found!");
        return;
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    console.log("Checking DEX at:", config.dexAddress);

    const [signer] = await ethers.getSigners();
    const AssetToken = await ethers.getContractFactory("AssetToken");
    const token = AssetToken.attach(config.tokenAddress);

    // Check DEX GLD Balance
    const dexBalance = await token.balanceOf(config.dexAddress);
    console.log("DEX GLD Balance:", ethers.formatEther(dexBalance));

    // Check DEX ETH Balance
    const provider = ethers.provider;
    const dexEth = await provider.getBalance(config.dexAddress);
    console.log("DEX ETH Balance:", ethers.formatEther(dexEth));

    // Check Oracle Price
    const AssetOracle = await ethers.getContractFactory("AssetOracle");
    const oracle = AssetOracle.attach(config.oracleAddress);
    const price = await oracle.getPrice("GLD");
    console.log("Oracle Price for GLD:", ethers.formatEther(price), "ETH");

    if (dexBalance == 0n) {
        console.error("CRITICAL: DEX has NO GLD Liquidity!");
    } else {
        console.log("Liquidity looks OK.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
