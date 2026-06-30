/**
 * BE2-2.4 · Deploy Script — BANTAYOG Smart Contracts
 *
 * Deployment order (respects dependencies):
 *   1. PHPC               — ERC-20 token (no deps)
 *   2. PHPCSubsidy        — UUPS proxy (depends on PHPC address)
 *   3. BeneficiaryRegistry — standalone Ownable (no deps)
 *   4. MerchantRegistry    — standalone Ownable (no deps)
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network saigon
 *   npx hardhat run scripts/deploy.ts --network localhost
 *
 * After deploying, copy the logged addresses into your .env:
 *   PHPC_TOKEN_ADDRESS=0x...
 *   PHPC_SUBSIDY_ADDRESS=0x...
 *   BENEFICIARY_REGISTRY_ADDRESS=0x...
 *   MERCHANT_REGISTRY_ADDRESS=0x...
 *
 * NOTE: This script uses viem (via hardhat-toolbox-viem). It does NOT use
 * Hardhat Ignition — the sequential deploy.ts approach is used here for
 * clarity and for the UUPS upgrade test (which needs raw contract instances).
 *
 * BE2 owns this script.
 */

import hre from "hardhat";
import { encodeFunctionData } from "viem";

async function main() {
  const connection = await hre.network.create();
  const viem = connection.viem;

  const [deployer] = await viem.getWalletClients();
  const deployerAddress = deployer.account.address;
  const publicClient = await viem.getPublicClient();

  console.log("=".repeat(60));
  console.log("BANTAYOG Contract Deployment");
  console.log("=".repeat(60));
  console.log(`Network:  ${hre.network.name}`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log("");

  // -------------------------------------------------------------------------
  // Step 1 — Deploy PHPC (ERC-20 token)
  // -------------------------------------------------------------------------

  console.log("1/4 Deploying PHPC...");
  const phpc = await viem.deployContract("PHPC", [deployerAddress]);
  await publicClient.waitForTransactionReceipt({ hash: phpc.deploymentTransaction?.hash as `0x${string}` });
  console.log(`    ✅ PHPC deployed at: ${phpc.address}`);

  // -------------------------------------------------------------------------
  // Step 2 — Deploy PHPCSubsidy as a UUPS proxy
  // -------------------------------------------------------------------------

  console.log("2/4 Deploying PHPCSubsidy (UUPS proxy)...");

  // Deploy the implementation contract first
  const subsidyImpl = await viem.deployContract("PHPCSubsidy", []);
  await publicClient.waitForTransactionReceipt({ hash: subsidyImpl.deploymentTransaction?.hash as `0x${string}` });
  console.log(`    Implementation: ${subsidyImpl.address}`);

  // Encode the initialize() call
  const initData = encodeFunctionData({
    abi: subsidyImpl.abi,
    functionName: "initialize",
    args: [phpc.address, deployerAddress],
  });

  // Deploy the UUPS proxy pointing to the implementation
  const proxy = await viem.deployContract("UUPSProxy", [
    subsidyImpl.address,
    initData,
  ]);
  await publicClient.waitForTransactionReceipt({ hash: proxy.deploymentTransaction?.hash as `0x${string}` });

  // Get a typed interface of PHPCSubsidy at the proxy address
  const phpcSubsidy = await viem.getContractAt("PHPCSubsidy", proxy.address);
  console.log(`    ✅ PHPCSubsidy proxy deployed at: ${phpcSubsidy.address}`);

  // -------------------------------------------------------------------------
  // Step 3 — Deploy BeneficiaryRegistry
  // -------------------------------------------------------------------------

  console.log("3/4 Deploying BeneficiaryRegistry...");
  const beneficiaryRegistry = await viem.deployContract("BeneficiaryRegistry", [deployerAddress]);
  await publicClient.waitForTransactionReceipt({ hash: beneficiaryRegistry.deploymentTransaction?.hash as `0x${string}` });
  console.log(`    ✅ BeneficiaryRegistry deployed at: ${beneficiaryRegistry.address}`);

  // -------------------------------------------------------------------------
  // Step 4 — Deploy MerchantRegistry
  // -------------------------------------------------------------------------

  console.log("4/4 Deploying MerchantRegistry...");
  const merchantRegistry = await viem.deployContract("MerchantRegistry", [deployerAddress]);
  await publicClient.waitForTransactionReceipt({ hash: merchantRegistry.deploymentTransaction?.hash as `0x${string}` });
  console.log(`    ✅ MerchantRegistry deployed at: ${merchantRegistry.address}`);

  // -------------------------------------------------------------------------
  // Summary — copy these into your .env
  // -------------------------------------------------------------------------

  console.log("");
  console.log("=".repeat(60));
  console.log("Deployment Complete — Add these to your .env:");
  console.log("=".repeat(60));
  console.log(`PHPC_TOKEN_ADDRESS=${phpc.address}`);
  console.log(`PHPC_SUBSIDY_ADDRESS=${phpcSubsidy.address}`);
  console.log(`BENEFICIARY_REGISTRY_ADDRESS=${beneficiaryRegistry.address}`);
  console.log(`MERCHANT_REGISTRY_ADDRESS=${merchantRegistry.address}`);
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exitCode = 1;
});
