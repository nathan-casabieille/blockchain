import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    const recipient = "0xA03569a9d45De7D9F3a7913d9a65B8458a50dF23"; // Updated from your screenshot

    console.log(`Sending 1,000 ETH to ${recipient}...`);

    // Send transaction
    const tx = await deployer.sendTransaction({
        to: recipient,
        value: ethers.parseEther("1000.0")
    });

    await tx.wait();

    console.log("Transaction confirmed!");
    console.log(`Hash: ${tx.hash}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
