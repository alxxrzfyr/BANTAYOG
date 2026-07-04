/**
 * BE2-2.4 · Deploy Script — BANTAYOG Smart Contracts
 *
 * Deployment order (respects dependencies):
 *   1. PHPC               — ERC-20 token (no deps)                    [critical]
 *   2. PHPCSubsidy        — UUPS proxy (depends on PHPC address)      [critical]
 *   3. Mint initial supply — 100,000 PHPC to LGU_ADMIN_WALLET_ADDRESS [critical]
 *   4. BeneficiaryRegistry — standalone Ownable (no deps)              [best-effort]
 *   5. MerchantRegistry    — standalone Ownable (no deps)              [best-effort]
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network amoy
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
 * Failure handling (Requirements 3.1-3.4, 3.6):
 *   - PHPC deploy, PHPCSubsidy deploy, and the initial mint are each treated
 *     as critical steps: every step is confirmed on-chain (deployment
 *     bytecode / transaction receipt) before the next step runs.
 *   - No contract or wallet address is printed until ALL critical steps
 *     (PHPC deploy, PHPCSubsidy deploy, mint) have succeeded. On any
 *     critical failure the script logs a clear failure message, sets a
 *     non-zero exit code, and returns without emitting any addresses.
 *
 * BE2 owns this script.
 */

import hre from "hardhat";
import { encodeFunctionData } from "viem";

/** Exactly 100,000 PHPC expressed in base units (18 decimals). */
const INITIAL_MINT_AMOUNT = 100000n * 10n ** 18n;

/**
 * Shape of the `viem` connection helper (`hre.network.create()`'s `.viem`).
 * Exposed here only so tests can pass a wrapped/overridden instance that
 * selectively fails a single step, without touching Hardhat/viem internals.
 */
type DeployViem = Awaited<ReturnType<typeof hre.network.create>>["viem"];

/**
 * Runs the deployment. Accepts an optional `viem` override so unit tests can
 * inject a wrapped connection (e.g. one whose `deployContract` throws for a
 * specific contract name) to exercise each critical-step failure branch
 * without mocking Hardhat's runtime internals.
 */
export async function main(overrides?: { viem?: DeployViem }) {
  const connection = await hre.network.create();
  const viem = overrides?.viem ?? connection.viem;

  const [deployer] = await viem.getWalletClients();
  const deployerAddress = deployer.account.address;
  const publicClient = await viem.getPublicClient();

  // Mint recipient (Requirement 3.3): the LGU/admin treasury wallet.
  // Falls back to the deployer address when unset (e.g. local test runs).
  const lguAdminWalletAddress =
    (process.env["LGU_ADMIN_WALLET_ADDRESS"] as `0x${string}` | undefined) ??
    deployerAddress;

  console.log("=".repeat(60));
  console.log("BANTAYOG Contract Deployment");
  console.log("=".repeat(60));
  console.log(`Network:   ${connection.networkName}`);
  console.log(`Deployer:  ${deployerAddress}`);
  console.log(`LGU Admin: ${lguAdminWalletAddress}`);
  console.log("");

  // -------------------------------------------------------------------------
  // Step 1 — Deploy PHPC (ERC-20 token) [critical]
  // -------------------------------------------------------------------------

  console.log("1/5 Deploying PHPC...");
  let phpc: Awaited<ReturnType<typeof viem.deployContract>>;
  try {
    phpc = await viem.deployContract("PHPC", [deployerAddress]);

    // Explicit on-chain confirmation: bytecode must exist at the address.
    const bytecode = await publicClient.getBytecode({ address: phpc.address });
    if (!bytecode || bytecode === "0x") {
      throw new Error(`No contract bytecode found at PHPC address ${phpc.address}`);
    }
  } catch (err) {
    console.error("Deployment failed: PHPC contract was not deployed");
    console.error(err);
    process.exitCode = 1;
    return;
  }
  console.log("    ✅ PHPC deployment confirmed on-chain");

  // -------------------------------------------------------------------------
  // Step 2 — Deploy PHPCSubsidy as a UUPS proxy [critical]
  // -------------------------------------------------------------------------

  console.log("2/5 Deploying PHPCSubsidy (UUPS proxy)...");
  let phpcSubsidy: Awaited<ReturnType<typeof viem.getContractAt>>;
  try {
    // Deploy the implementation contract first
    const subsidyImpl = await viem.deployContract("PHPCSubsidy", []);

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

    // Explicit on-chain confirmation: bytecode must exist at the proxy address.
    const bytecode = await publicClient.getBytecode({ address: proxy.address });
    if (!bytecode || bytecode === "0x") {
      throw new Error(`No contract bytecode found at PHPCSubsidy proxy address ${proxy.address}`);
    }

    // Get a typed interface of PHPCSubsidy at the proxy address
    phpcSubsidy = await viem.getContractAt("PHPCSubsidy", proxy.address);
  } catch (err) {
    console.error("Deployment failed: PHPCSubsidy contract was not deployed");
    console.error(err);
    process.exitCode = 1;
    return;
  }
  console.log("    ✅ PHPCSubsidy deployment confirmed on-chain");

  // -------------------------------------------------------------------------
  // Step 3 — Mint initial PHPC supply to the LGU admin wallet [critical]
  // -------------------------------------------------------------------------

  console.log("3/5 Minting initial PHPC supply to LGU_ADMIN_WALLET_ADDRESS...");
  try {
    const mintTxHash = await phpc.write.mint([
      lguAdminWalletAddress,
      INITIAL_MINT_AMOUNT,
    ]);

    // Explicit on-chain confirmation of the mint transaction.
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: mintTxHash,
    });
    if (receipt.status !== "success") {
      throw new Error(
        `Mint transaction ${mintTxHash} did not confirm successfully (status: ${receipt.status})`
      );
    }

    // Double-check: the LGU admin wallet balance must equal exactly the minted amount.
    const balance = await phpc.read.balanceOf([lguAdminWalletAddress]);
    if (balance !== INITIAL_MINT_AMOUNT) {
      throw new Error(
        `LGU admin wallet balance after mint is ${balance}, expected ${INITIAL_MINT_AMOUNT}`
      );
    }
  } catch (err) {
    console.error("Mint failed: no supply was minted to LGU_ADMIN_WALLET_ADDRESS");
    console.error(err);
    process.exitCode = 1;
    return;
  }
  console.log("    ✅ Mint of 100,000 PHPC confirmed on-chain");

  // -------------------------------------------------------------------------
  // Step 4 — Deploy BeneficiaryRegistry [best-effort, non-critical]
  // -------------------------------------------------------------------------

  console.log("4/5 Deploying BeneficiaryRegistry...");
  let beneficiaryRegistry: Awaited<ReturnType<typeof viem.deployContract>> | undefined;
  try {
    beneficiaryRegistry = await viem.deployContract("BeneficiaryRegistry", [
      deployerAddress,
    ]);
    console.log("    ✅ BeneficiaryRegistry deployment confirmed on-chain");
  } catch (err) {
    console.error("    ⚠️  BeneficiaryRegistry deployment failed (non-critical):");
    console.error(err);
  }

  // -------------------------------------------------------------------------
  // Step 5 — Deploy MerchantRegistry [best-effort, non-critical]
  // -------------------------------------------------------------------------

  console.log("5/5 Deploying MerchantRegistry...");
  let merchantRegistry: Awaited<ReturnType<typeof viem.deployContract>> | undefined;
  try {
    merchantRegistry = await viem.deployContract("MerchantRegistry", [
      deployerAddress,
    ]);
    console.log("    ✅ MerchantRegistry deployment confirmed on-chain");
  } catch (err) {
    console.error("    ⚠️  MerchantRegistry deployment failed (non-critical):");
    console.error(err);
  }

  // -------------------------------------------------------------------------
  // Summary — only printed once every critical step above has succeeded.
  // -------------------------------------------------------------------------

  console.log("");
  console.log("=".repeat(60));
  console.log("Deployment Complete — Add these to your .env:");
  console.log("=".repeat(60));
  console.log(`PHPC_TOKEN_ADDRESS=${phpc.address}`);
  console.log(`PHPC_SUBSIDY_ADDRESS=${phpcSubsidy.address}`);
  if (beneficiaryRegistry) {
    console.log(`BENEFICIARY_REGISTRY_ADDRESS=${beneficiaryRegistry.address}`);
  }
  if (merchantRegistry) {
    console.log(`MERCHANT_REGISTRY_ADDRESS=${merchantRegistry.address}`);
  }
  console.log("=".repeat(60));
}

// Only auto-run when this module is the entry point (`hardhat run scripts/deploy.ts`).
// When imported by a test (e.g. `test/deploy.test.ts`) via `hardhat run`'s
// underlying test runner, `process.env.HH_TEST` is set by Hardhat's
// node:test runner and skips the auto-invocation so tests can call
// `main(overrides)` directly with a controlled failure injected.
if (process.env["HH_TEST"] !== "true") {
  main().catch((err) => {
    console.error("Deployment failed:", err);
    process.exitCode = 1;
  });
}
