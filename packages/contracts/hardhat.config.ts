import { defineConfig } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";

// ---------------------------------------------------------------------------
// Env-var helpers — all chain vars are optional at compile time;
// only required when actually deploying to a live network.
// Hardhat 3 is ESM-first; load env vars via process.env (populated by
// shell / CI / Vercel env injection rather than a dotenv import).
// ---------------------------------------------------------------------------
const RONIN_SAIGON_RPC_URL =
  process.env["RONIN_SAIGON_RPC_URL"] ?? "https://saigon-testnet.roninchain.com/rpc";

const RONIN_MAINNET_RPC_URL =
  process.env["RONIN_MAINNET_RPC_URL"] ?? "https://api.roninchain.com/rpc";

// Testnet-only deployer key — zero monetary value on Saigon.
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
  // `saigon` is the only live network in v1 scope (ADR-0001 Cross-Decision).
  // `ronin` mainnet entry exists for future migration; NEVER used in v1.
  // ---------------------------------------------------------------------------
  networks: {
    // Local Hardhat node — EDR-simulated, used for unit tests
    hardhat: {
      type: "edr-simulated",
      chainId: 31337,
    },

    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },

    // Ronin Saigon testnet — chain ID 202601 (verified from Ronin Docs)
    saigon: {
      type: "http",
      url: RONIN_SAIGON_RPC_URL,
      chainId: 202601,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },

    // Ronin mainnet — chainId 2020.
    // ⚠️  OUT OF SCOPE FOR V1. Do not deploy here before P6 gate review.
    // ⚠️  Requires a separate mainnet deployer key per ADR-0001 Decision 1.
    ronin: {
      type: "http",
      url: RONIN_MAINNET_RPC_URL,
      chainId: 2020,
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
