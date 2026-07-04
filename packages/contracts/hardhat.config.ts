import { defineConfig } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";

// ---------------------------------------------------------------------------
// Load packages/contracts/.env into process.env for local/manual deploys.
// CI/Vercel environments inject env vars directly, so a missing .env file
// here is not an error — only real parsing/syntax errors are surfaced.
// Uses Node's built-in loadEnvFile (Node 20.12+/22+) instead of adding a
// dotenv dependency.
// ---------------------------------------------------------------------------
try {
  process.loadEnvFile(new URL("./.env", import.meta.url));
} catch (err: any) {
  if (err?.code !== "ENOENT") {
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Env-var helpers — all chain vars are optional at compile time;
// only required when actually deploying to a live network.
// ---------------------------------------------------------------------------
// Polygon Amoy testnet RPC endpoint — chain ID 80002.
const POLYGON_AMOY_RPC_URL =
  process.env["POLYGON_AMOY_RPC_URL"] ?? "https://rpc-amoy.polygon.technology";

// Testnet-only deployer key — zero monetary value on Polygon Amoy.
// NEVER load a mainnet key without a dedicated key-rotation runbook (ADR-0001 Decision 1).
// Falls back to Hardhat's well-known default account #0 for local testing.
const DEPLOYER_PRIVATE_KEY: `0x${string}` =
  (process.env["DEPLOYER_PRIVATE_KEY"] as `0x${string}`) ??
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

export default defineConfig({
  // ---------------------------------------------------------------------------
  // Hardhat 3 plugins — uses the `plugins` array (not side-effect imports from H2).
  // `hardhat-toolbox-viem` v5.x is the Hardhat-3-native version:
  //   bundles hardhat-viem, hardhat-ignition-viem, hardhat-verify,
  //   hardhat-network-helpers, hardhat-node-test-runner, viem-assertions, keystore.
  // ---------------------------------------------------------------------------
  plugins: [hardhatToolboxViem],

  // ---------------------------------------------------------------------------
  // Solidity compiler — pinned to 0.8.28 per BANTAYOG_PROJECT_PLAN.md §5.
  // London EVM-compatible; required for OZ 5.x + UUPS proxies.
  // ---------------------------------------------------------------------------
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "london",
    },
  },

  // ---------------------------------------------------------------------------
  // Networks — Hardhat 3 requires explicit `type` on each network entry.
  //   type: "edr-simulated" — local in-process Hardhat network (EDR backend)
  //   type: "http"          — any external network reached via JSON-RPC
  //
  // `amoy` (Polygon Amoy, chain ID 80002) is the only live network in v1 scope
  // per this migration (polygon-amoy-phpc-migration). The former Ronin
  // Saigon/mainnet entries have been removed as part of that migration.
  // ---------------------------------------------------------------------------
  networks: {
    // Local Hardhat node — EDR-simulated, used for unit tests only.
    hardhat: {
      type: "edr-simulated",
      chainId: 31337,
    },

    // Polygon Amoy testnet — chain ID 80002, the v1 target network.
    amoy: {
      type: "http",
      url: POLYGON_AMOY_RPC_URL,
      chainId: 80002,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    ignition: "./ignition",
  },
});
