/**
 * BE2-2.4 · Deploy Script — Error Handling Unit Tests
 *
 * Exercises the deployment orchestration's failure branches in
 * `scripts/deploy.ts` (Requirements 3.2, 3.4):
 *   - PHPC deployment failure aborts before PHPCSubsidy is deployed and
 *     before any address is printed.
 *   - PHPCSubsidy deployment failure (PHPC already deployed) aborts before
 *     the mint step runs and before any address is printed.
 *   - Mint failure (both deploys succeeded) aborts before any address is
 *     printed and leaves the LGU admin wallet balance unminted.
 *
 * Approach: `scripts/deploy.ts` exports `main(overrides)`, where
 * `overrides.viem` lets a test supply a wrapped `viem` connection whose
 * `deployContract` (or whose `mint` write, via a wrapped PHPC instance)
 * throws for a specific step while every other step runs against the real
 * Hardhat in-process network. This exercises deploy.ts's ACTUAL try/catch
 * failure-handling branches (not a re-implementation of the guard logic)
 * without needing to mock Hardhat/viem internals — the underlying contract
 * calls are real, only the single targeted call is made to reject.
 *
 * `console.log`/`console.error` are captured for each run to assert on the
 * exact failure message and on the absence of any `_ADDRESS=` summary line.
 *
 * Uses Hardhat 3 + hardhat-toolbox-viem's node:test runner (matches the
 * convention in test/uups-upgrade.test.ts).
 * BE2 owns this test.
 */

import { expect } from "chai";
import hre from "hardhat";
import { describe, it, before, beforeEach, afterEach } from "node:test";
import { main } from "../scripts/deploy.js";

// -------------------------------------------------------------------------
// console capture helper
// -------------------------------------------------------------------------

function captureConsole() {
  const logs: string[] = [];
  const errors: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  };
  return {
    logs,
    errors,
    restore() {
      console.log = originalLog;
      console.error = originalError;
    },
  };
}

describe("deploy.ts — deployment orchestration error handling", function () {
  let viem: any;
  let originalExitCode: number | string | null | undefined;

  before(async function () {
    const connection = await hre.network.create();
    viem = connection.viem;
  });

  beforeEach(function () {
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(function () {
    process.exitCode = originalExitCode;
  });

  it("aborts when PHPC deployment fails, printing no addresses and never deploying PHPCSubsidy", async function () {
    let subsidyDeployAttempted = false;

    const failingViem = {
      ...viem,
      deployContract: async (name: string, args: unknown[]) => {
        if (name === "PHPC") {
          throw new Error("simulated PHPC deployment failure");
        }
        if (name === "PHPCSubsidy" || name === "UUPSProxy") {
          subsidyDeployAttempted = true;
        }
        return viem.deployContract(name, args);
      },
    };

    const capture = captureConsole();
    try {
      await main({ viem: failingViem });
    } finally {
      capture.restore();
    }

    expect(subsidyDeployAttempted).to.equal(false);
    expect(process.exitCode).to.equal(1);

    const allErrors = capture.errors.join("\n");
    expect(allErrors).to.include(
      "Deployment failed: PHPC contract was not deployed"
    );

    const allOutput = [...capture.logs, ...capture.errors].join("\n");
    expect(allOutput).to.not.include("PHPC_TOKEN_ADDRESS=");
    expect(allOutput).to.not.include("PHPC_SUBSIDY_ADDRESS=");
  });

  it("aborts when PHPCSubsidy deployment fails (PHPC succeeds first), printing no addresses and never attempting the mint", async function () {
    let mintAttempted = false;

    const failingViem = {
      ...viem,
      deployContract: async (name: string, args: unknown[]) => {
        if (name === "UUPSProxy") {
          throw new Error("simulated PHPCSubsidy proxy deployment failure");
        }
        const contract = await viem.deployContract(name, args);
        if (name === "PHPC") {
          // Wrap the returned PHPC instance so we can detect (and fail the
          // test if) mint is ever reached after the PHPCSubsidy failure.
          return {
            ...contract,
            write: {
              ...contract.write,
              mint: async (mintArgs: unknown[]) => {
                mintAttempted = true;
                return contract.write.mint(mintArgs as [`0x${string}`, bigint]);
              },
            },
          };
        }
        return contract;
      },
    };

    const capture = captureConsole();
    try {
      await main({ viem: failingViem });
    } finally {
      capture.restore();
    }

    expect(mintAttempted).to.equal(false);
    expect(process.exitCode).to.equal(1);

    const allErrors = capture.errors.join("\n");
    expect(allErrors).to.include(
      "Deployment failed: PHPCSubsidy contract was not deployed"
    );

    const allOutput = [...capture.logs, ...capture.errors].join("\n");
    expect(allOutput).to.not.include("PHPC_TOKEN_ADDRESS=");
    expect(allOutput).to.not.include("PHPC_SUBSIDY_ADDRESS=");
  });

  it("aborts when the mint fails (both deploys succeed), reporting the mint failure and printing no addresses", async function () {
    const failingViem = {
      ...viem,
      deployContract: async (name: string, args: unknown[]) => {
        const contract = await viem.deployContract(name, args);
        if (name === "PHPC") {
          // Wrap the returned PHPC instance so its mint call reverts,
          // simulating an on-chain mint failure after both deploys succeeded.
          return {
            ...contract,
            write: {
              ...contract.write,
              mint: async () => {
                throw new Error("simulated mint transaction failure");
              },
            },
          };
        }
        return contract;
      },
    };

    const capture = captureConsole();
    try {
      await main({ viem: failingViem });
    } finally {
      capture.restore();
    }

    expect(process.exitCode).to.equal(1);

    const allErrors = capture.errors.join("\n");
    expect(allErrors).to.include(
      "Mint failed: no supply was minted to LGU_ADMIN_WALLET_ADDRESS"
    );

    const allOutput = [...capture.logs, ...capture.errors].join("\n");
    expect(allOutput).to.not.include("PHPC_TOKEN_ADDRESS=");
    expect(allOutput).to.not.include("PHPC_SUBSIDY_ADDRESS=");
  });
});

describe("deploy.ts — deployed address format", function () {
  it("prints PHPC and PHPCSubsidy addresses matching the standard 40-hex-char EVM address format", async function () {
    // viem's `Address` type is already checksummed/well-formed by
    // construction from a real deployment, so this test's main value is
    // confirming the deploy script's PRINTED OUTPUT format (the
    // console.log summary lines) is a valid, standard 0x-prefixed
    // 40-hex-character EVM address — guarding against any accidental
    // truncation, wrong encoding, or malformed string interpolation when
    // the addresses are logged (Requirement 3.6).
    const originalExitCode = process.exitCode;
    process.exitCode = undefined;

    const capture = captureConsole();
    try {
      await main();
    } finally {
      capture.restore();
      process.exitCode = originalExitCode;
    }

    const allLogs = capture.logs.join("\n");
    const tokenMatch = allLogs.match(/PHPC_TOKEN_ADDRESS=(0x[0-9a-fA-F]+)/);
    const subsidyMatch = allLogs.match(/PHPC_SUBSIDY_ADDRESS=(0x[0-9a-fA-F]+)/);

    // The summary block must actually have been printed (i.e. the deploy
    // succeeded) before we can assert anything about its address format.
    expect(tokenMatch).to.not.equal(null);
    expect(subsidyMatch).to.not.equal(null);

    const tokenAddress = tokenMatch![1];
    const subsidyAddress = subsidyMatch![1];

    expect(tokenAddress).to.match(/^0x[0-9a-fA-F]{40}$/);
    expect(subsidyAddress).to.match(/^0x[0-9a-fA-F]{40}$/);
  });
});

// -------------------------------------------------------------------------
// BE2-2.4 · Task 14.4 — PHPC decimals() and treasury balance unit tests
// -------------------------------------------------------------------------

/**
 * Exercises PHPC.sol's own `decimals()` override and the post-mint treasury
 * balance invariant from the deploy script (Requirements 3.5, 3.7):
 *   - PHPC.decimals() returns exactly 18.
 *   - After a fresh deploy + initial mint (via `main()`), and with no
 *     allocations having been made yet, the LGU admin wallet's PHPC balance
 *     equals exactly 100,000 PHPC (100000n * 10n ** 18n) — nothing more,
 *     nothing less.
 *
 * BE2 owns this test.
 */
describe("PHPC — decimals() and treasury balance (Requirements 3.5, 3.7)", function () {
  let viem: any;

  before(async function () {
    const connection = await hre.network.create();
    viem = connection.viem;
  });

  it("PHPC.decimals() returns exactly 18", async function () {
    const [deployer] = await viem.getWalletClients();
    const deployerAddress = deployer.account.address;

    const phpc = await viem.deployContract("PHPC", [deployerAddress]);
    const decimals = await phpc.read.decimals();

    expect(decimals).to.equal(18);
  });

  it(
    "treasury (LGU admin) balance equals exactly 100,000 PHPC " +
      "(100000n * 10n ** 18n) after deploy + mint, with no allocations made",
    async function () {
      const [deployer] = await viem.getWalletClients();
      const lguAdminWalletAddress = deployer.account.address as `0x${string}`;

      // Ensure main() falls back to the deployer address as the mint
      // recipient (no LGU_ADMIN_WALLET_ADDRESS env override for this test).
      const originalEnvValue = process.env["LGU_ADMIN_WALLET_ADDRESS"];
      delete process.env["LGU_ADMIN_WALLET_ADDRESS"];

      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      };

      try {
        await main({ viem });
      } finally {
        console.log = originalLog;
        if (originalEnvValue === undefined) {
          delete process.env["LGU_ADMIN_WALLET_ADDRESS"];
        } else {
          process.env["LGU_ADMIN_WALLET_ADDRESS"] = originalEnvValue;
        }
      }

      const addressLine = logs.find((line) =>
        line.includes("PHPC_TOKEN_ADDRESS=")
      );
      expect(addressLine, "expected a PHPC_TOKEN_ADDRESS= line in the deploy output").to
        .exist;

      const phpcTokenAddress = addressLine!
        .split("PHPC_TOKEN_ADDRESS=")[1]!
        .trim() as `0x${string}`;

      const phpc = await viem.getContractAt("PHPC", phpcTokenAddress);
      const balance: bigint = await phpc.read.balanceOf([
        lguAdminWalletAddress,
      ]);

      // No allocation logic exists yet (that's task 10), so the balance
      // must equal exactly the initial mint amount — nothing deducted.
      expect(balance).to.equal(100000n * 10n ** 18n);
    }
  );
});

// -------------------------------------------------------------------------
// BE2-2.4 · Task 14.6 — deploy + mint end-to-end integration test
// -------------------------------------------------------------------------

/**
 * Unlike every other describe block in this file — which checks the deploy
 * script's OWN internal error-handling branches (the failure-injection
 * tests above) or the FORMAT of what it printed / the balance it reports
 * reading back through `main()`'s own connection — this test independently
 * re-queries chain state through a dedicated `publicClient` obtained from
 * the test's own connection, rather than trusting `main()`'s internal
 * bytecode/receipt/balance checks or its console output alone. That
 * independent re-verification (bytecode actually present at each deployed
 * address, and the mint's balance change actually visible on-chain) is what
 * makes this an END-TO-END INTEGRATION TEST of the "wait for confirmation"
 * behavior described in Requirements 3.1 and 3.3, rather than a restatement
 * of what the script already asserts about itself.
 */
describe("deploy.ts — end-to-end integration: deploy + mint confirmation sequence", function () {
  let viem: any;

  before(async function () {
    const connection = await hre.network.create();
    viem = connection.viem;
  });

  it(
    "confirms PHPC deployment, then PHPCSubsidy deployment, then the mint " +
      "— each verified independently on-chain via a separate publicClient " +
      "(Requirements 3.1, 3.3)",
    async function () {
      const [deployer] = await viem.getWalletClients();
      const deployerAddress = deployer.account.address as `0x${string}`;

      // Ensure main() falls back to the deployer address as the mint
      // recipient, matching the pattern used by the task-14.4 balance test,
      // so the recipient here is deterministic.
      const originalEnvValue = process.env["LGU_ADMIN_WALLET_ADDRESS"];
      delete process.env["LGU_ADMIN_WALLET_ADDRESS"];

      const originalExitCode = process.exitCode;
      process.exitCode = undefined;

      const capture = captureConsole();
      try {
        await main({ viem });
      } finally {
        capture.restore();
        if (originalEnvValue === undefined) {
          delete process.env["LGU_ADMIN_WALLET_ADDRESS"];
        } else {
          process.env["LGU_ADMIN_WALLET_ADDRESS"] = originalEnvValue;
        }
      }

      // The script must have completed successfully: no non-zero exit code
      // was set, and the summary block (both address lines) was printed.
      expect(process.exitCode).to.equal(undefined);
      process.exitCode = originalExitCode;

      const allLogs = capture.logs.join("\n");
      expect(allLogs).to.include("PHPC_TOKEN_ADDRESS=");
      expect(allLogs).to.include("PHPC_SUBSIDY_ADDRESS=");

      const tokenMatch = allLogs.match(/PHPC_TOKEN_ADDRESS=(0x[0-9a-fA-F]+)/);
      const subsidyMatch = allLogs.match(
        /PHPC_SUBSIDY_ADDRESS=(0x[0-9a-fA-F]+)/
      );
      expect(tokenMatch, "expected a PHPC_TOKEN_ADDRESS= line").to.not.equal(
        null
      );
      expect(
        subsidyMatch,
        "expected a PHPC_SUBSIDY_ADDRESS= line"
      ).to.not.equal(null);

      const phpcAddress = tokenMatch![1] as `0x${string}`;
      const phpcSubsidyAddress = subsidyMatch![1] as `0x${string}`;

      // Independent on-chain confirmation — a fresh publicClient call, not
      // a reuse of any value main() computed internally.
      const publicClient = await viem.getPublicClient();

      const phpcBytecode = await publicClient.getBytecode({
        address: phpcAddress,
      });
      expect(
        phpcBytecode,
        "PHPC deployment must be confirmed on-chain (non-empty bytecode)"
      ).to.exist;
      expect(phpcBytecode).to.not.equal("0x");

      const phpcSubsidyBytecode = await publicClient.getBytecode({
        address: phpcSubsidyAddress,
      });
      expect(
        phpcSubsidyBytecode,
        "PHPCSubsidy proxy deployment must be confirmed on-chain (non-empty bytecode)"
      ).to.exist;
      expect(phpcSubsidyBytecode).to.not.equal("0x");

      // Independent mint confirmation: read PHPC.balanceOf directly through
      // a freshly attached contract instance, not through main()'s return
      // value or internal balance check.
      const phpc = await viem.getContractAt("PHPC", phpcAddress);
      const balance: bigint = await phpc.read.balanceOf([deployerAddress]);
      expect(balance).to.equal(100000n * 10n ** 18n);
    }
  );
});
