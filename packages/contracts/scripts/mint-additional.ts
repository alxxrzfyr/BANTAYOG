/**
 * One-off maintenance script: mint additional PHPC to the LGU admin wallet
 * on top of an already-deployed PHPC contract (no redeploy needed).
 *
 * PHPC.mint() is `onlyOwner`, and the deployer wallet is the contract owner,
 * so this works against the existing deployed contract at PHPC_TOKEN_ADDRESS.
 *
 * Usage:
 *   npx hardhat run scripts/mint-additional.ts --network amoy
 *
 * The amount to mint (in whole PHPC) is read from MINT_ADDITIONAL_PHPC env
 * var, defaulting to 900000 (bringing a 100,000 starting balance to
 * 1,000,000 total).
 */
import hre from "hardhat";

async function main() {
  const additionalPhpc = BigInt(process.env["MINT_ADDITIONAL_PHPC"] ?? "900000");
  const additionalWei = additionalPhpc * 10n ** 18n;

  const tokenAddress = process.env["PHPC_TOKEN_ADDRESS"] as `0x${string}` | undefined;
  const lguAdminWalletAddress = process.env["LGU_ADMIN_WALLET_ADDRESS"] as `0x${string}` | undefined;

  if (!tokenAddress) throw new Error("PHPC_TOKEN_ADDRESS is not set in packages/contracts/.env");
  if (!lguAdminWalletAddress) throw new Error("LGU_ADMIN_WALLET_ADDRESS is not set in packages/contracts/.env");

  const connection = await hre.network.create();
  const viem = connection.viem;
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  console.log("=".repeat(60));
  console.log("BANTAYOG — Mint Additional PHPC");
  console.log("=".repeat(60));
  console.log(`Network:        ${connection.networkName}`);
  console.log(`PHPC Token:     ${tokenAddress}`);
  console.log(`Deployer:       ${deployer.account.address}`);
  console.log(`LGU Wallet:     ${lguAdminWalletAddress}`);
  console.log(`Minting:        ${additionalPhpc.toLocaleString()} PHPC`);
  console.log("");

  // Check deployer's native gas balance before attempting the mint.
  const gasBalance = await publicClient.getBalance({ address: deployer.account.address });
  console.log(`Deployer POL balance: ${Number(gasBalance) / 1e18} POL`);
  if (gasBalance === 0n) {
    throw new Error("Deployer wallet has 0 POL — cannot pay gas for the mint transaction.");
  }

  const phpc = await viem.getContractAt("PHPC", tokenAddress);

  const balanceBefore = await phpc.read.balanceOf([lguAdminWalletAddress]);
  console.log(`LGU balance before: ${balanceBefore / 10n ** 18n} PHPC`);

  console.log("\nSubmitting mint transaction...");
  const mintTxHash = await phpc.write.mint([lguAdminWalletAddress, additionalWei]);
  console.log(`Tx hash: ${mintTxHash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: mintTxHash });
  if (receipt.status !== "success") {
    throw new Error(`Mint transaction ${mintTxHash} did not confirm successfully (status: ${receipt.status})`);
  }

  const balanceAfter = await phpc.read.balanceOf([lguAdminWalletAddress]);
  console.log(`\n✅ Mint confirmed on-chain.`);
  console.log(`LGU balance after:  ${balanceAfter / 10n ** 18n} PHPC`);
}

main().catch((err) => {
  console.error("Mint failed:", err);
  process.exitCode = 1;
});
