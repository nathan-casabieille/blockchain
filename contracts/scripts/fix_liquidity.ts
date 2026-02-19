import { ethers } from "hardhat";
const fs = require('fs');
const path = require('path');

async function main() {
    const configPath = path.join(__dirname, "../../frontend/src/lib/contracts-config.json");
    if (!fs.existsSync(configPath)) {
        console.error("Config not found!");
        return;
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    console.log("Fixing DEX Liquidity at:", config.dexAddress);

    const [signer] = await ethers.getSigners();
    console.log("Signer:", signer.address);

    const AssetToken = await ethers.getContractFactory("AssetToken");
    const token = AssetToken.attach(config.tokenAddress);

    const ComplianceRegistry = await ethers.getContractFactory("ComplianceRegistry");
    const compliance = ComplianceRegistry.attach(config.complianceAddress);

    try {
        // 1. Ensure Whitelisted
        console.log("Checking Compliance...");
        const isDexVerified = await compliance.isVerified(config.dexAddress);
        if (!isDexVerified) {
            console.log("Whitelisting DEX...");
            const tx = await compliance.addToWhitelist(config.dexAddress);
            await tx.wait();
        } else {
            console.log("DEX is already verified.");
        }

        const isSignerVerified = await compliance.isVerified(signer.address);
        if (!isSignerVerified) {
            console.log("Whitelisting Signer...");
            const tx = await compliance.addToWhitelist(signer.address);
            await tx.wait();
        }

        // 2. Check Signer Balance
        let signerBal = await token.balanceOf(signer.address);
        console.log("Signer Balance:", ethers.formatEther(signerBal));

        if (signerBal < ethers.parseEther("50000")) {
            console.log("Minting tokens to signer...");
            const tx = await token.mint(signer.address, ethers.parseEther("100000"));
            await tx.wait();
            console.log("Minted 100k.");
        }

        // 3. Fund DEX GLD
        const dexBal = await token.balanceOf(config.dexAddress);
        console.log("Current DEX Balance:", ethers.formatEther(dexBal));

        if (dexBal < ethers.parseEther("50000")) {
            console.log("Transferring 50k GLD to DEX...");
            const tx = await token.transfer(config.dexAddress, ethers.parseEther("50000"));
            await tx.wait();
            console.log("Transferred!");
        } else {
            console.log("DEX has sufficient GLD.");
        }

        // 4. Fund DEX ETH
        const provider = ethers.provider;
        const dexEth = await provider.getBalance(config.dexAddress);
        console.log("Current DEX ETH:", ethers.formatEther(dexEth));

        if (dexEth < ethers.parseEther("5")) {
            console.log("Sending 10 ETH to DEX...");
            const tx = await signer.sendTransaction({
                to: config.dexAddress,
                value: ethers.parseEther("10")
            });
            await tx.wait();
            console.log("Sent ETH.");
        }

        console.log("Liquidity Fix Complete!");

    } catch (e) {
        console.error("Error fixing liquidity:", e);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
