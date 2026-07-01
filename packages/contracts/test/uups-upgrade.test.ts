/**
 * BE2-2.4 · UUPS Upgrade Test — PHPCSubsidy
 *
 * Tests the full UUPS upgrade lifecycle:
 *   1. Deploy PHPCSubsidy v1 (via ERC1967Proxy)
 *   2. Verify v1 state and functions
 *   3. Deploy PHPCSubsidyV2Mock (a minimal upgrade stub)
 *   4. Upgrade the proxy to v2
 *   5. Verify state is preserved across the upgrade
 *   6. Verify new v2 function is accessible
 *   7. Verify v1 functions still work
 *
 * Uses Hardhat 3 + hardhat-toolbox-viem + viem assertions.
 * BE2 owns this test.
 */

import { expect } from "chai";
import hre from "hardhat";
import type { WalletClient } from "viem";
import { parseUnits, keccak256, toBytes, encodeFunctionData } from "viem";
import { describe, it, before } from "node:test";

// -------------------------------------------------------------------------
// Helper: deploy PHPC + PHPCSubsidy proxy
// -------------------------------------------------------------------------

async function deploySubsidySystem(deployer: WalletClient, viem: any) {
  const addr = deployer.account!.address;

  // Deploy PHPC token
  const phpc = await viem.deployContract("PHPC", [addr]);

  // Deploy implementation
  const impl = await viem.deployContract("PHPCSubsidy", []);

  // Encode initialize call
  const initData = encodeFunctionData({
    abi: impl.abi,
    functionName: "initialize",
    args: [phpc.address, addr],
  });

  // Deploy UUPSProxy
  const proxy = await viem.deployContract("UUPSProxy", [
    impl.address,
    initData,
  ]);

  // Get typed PHPCSubsidy interface at proxy address
  const subsidy = await viem.getContractAt("PHPCSubsidy", proxy.address);

  return { phpc, impl, proxy, subsidy };
}

// -------------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------------

describe("PHPCSubsidy — UUPS Upgrade", function () {
  let viem: any;
  let deployer: WalletClient;
  let user: WalletClient;

  before(async function () {
    const connection = await hre.network.create();
    viem = connection.viem;
    [deployer, user] = await viem.getWalletClients();
  });

  // ---
  // Section 1: v1 basic functionality
  // ---
  describe("v1 — Basic Functionality", function () {
    it("should initialize with correct PHPC token address", async function () {
      const { phpc, subsidy } = await deploySubsidySystem(deployer, viem);
      const storedToken = await subsidy.read.phpcToken();
      expect(storedToken.toLowerCase()).to.equal(phpc.address.toLowerCase());
    });

    it("should initialize with deployer as owner", async function () {
      const { subsidy } = await deploySubsidySystem(deployer, viem);
      const owner = await subsidy.read.owner();
      expect(owner.toLowerCase()).to.equal(
        deployer.account!.address.toLowerCase()
      );
    });

    it("should allow owner to depositFunds and allocateCredits", async function () {
      const { phpc, subsidy } = await deploySubsidySystem(deployer, viem);
      const deployerAddr = deployer.account!.address;

      const depositAmount = parseUnits("1000", 18);
      const allocAmount = parseUnits("500", 18);
      const beneficiaryId = keccak256(toBytes("test-beneficiary-uuid-001"));

      // Mint PHPC to deployer
      await phpc.write.mint([deployerAddr, depositAmount]);

      // Approve subsidy contract
      await phpc.write.approve([subsidy.address, depositAmount]);

      // Deposit funds
      await subsidy.write.depositFunds([depositAmount]);

      // Allocate credits
      await subsidy.write.allocateCredits([beneficiaryId, allocAmount]);

      // Verify balance
      const balance = await subsidy.read.getBalance([beneficiaryId]);
      expect(balance).to.equal(allocAmount);
    });

    it("should revert processTransaction if beneficiary has insufficient balance", async function () {
      const { phpc, subsidy } = await deploySubsidySystem(deployer, viem);
      const deployerAddr = deployer.account!.address;
      const merchantAddr = user.account!.address;

      const beneficiaryId = keccak256(toBytes("test-beneficiary-insufficient"));
      const deposit = parseUnits("100", 18);

      await phpc.write.mint([deployerAddr, deposit]);
      await phpc.write.approve([subsidy.address, deposit]);
      await subsidy.write.depositFunds([deposit]);
      await subsidy.write.allocateCredits([beneficiaryId, deposit]);

      const txId = keccak256(toBytes("tx-001"));
      const overAmount = parseUnits("200", 18); // More than allocated

      let errorThrown = false;
      try {
        await subsidy.write.processTransaction([
          beneficiaryId,
          merchantAddr,
          overAmount,
          txId,
        ]);
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).to.include("InsufficientBeneficiaryBalance");
      }
      expect(errorThrown).to.be.true;
    });

    it("should reject upgrade from non-owner", async function () {
      const { subsidy } = await deploySubsidySystem(deployer, viem);

      // Deploy a new impl
      const newImpl = await viem.deployContract("PHPCSubsidy", []);

      // Attempt upgrade from non-owner
      const subsidyAsUser = await viem.getContractAt(
        "PHPCSubsidy",
        subsidy.address,
        { client: { wallet: user } }
      );

      let errorThrown = false;
      try {
        await subsidyAsUser.write.upgradeToAndCall([newImpl.address, "0x"]);
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).to.include("OwnableUnauthorizedAccount");
      }
      expect(errorThrown).to.be.true;
    });
  });

  // ---
  // Section 2: UUPS Upgrade
  // ---
  describe("UUPS Upgrade — v1 → v2", function () {
    it("should preserve state across upgrade", async function () {
      const { phpc, subsidy } = await deploySubsidySystem(deployer, viem);
      const deployerAddr = deployer.account!.address;

      const beneficiaryId = keccak256(toBytes("upgrade-beneficiary-uuid-001"));
      const allocAmount = parseUnits("750", 18);

      // Set up state in v1
      await phpc.write.mint([deployerAddr, allocAmount]);
      await phpc.write.approve([subsidy.address, allocAmount]);
      await subsidy.write.depositFunds([allocAmount]);
      await subsidy.write.allocateCredits([beneficiaryId, allocAmount]);

      // Confirm v1 state
      const balanceBefore = await subsidy.read.getBalance([beneficiaryId]);
      expect(balanceBefore).to.equal(allocAmount);

      // Deploy PHPCSubsidyV2Mock
      const newImpl = await viem.deployContract("PHPCSubsidyV2Mock", []);

      // Upgrade via UUPS
      await subsidy.write.upgradeToAndCall([newImpl.address, "0x"]);

      // Cast proxy to v2 ABI
      const subsidyV2 = await viem.getContractAt(
        "PHPCSubsidyV2Mock",
        subsidy.address
      );

      // Verify: state preserved
      const balanceAfter = await subsidyV2.read.getBalance([beneficiaryId]);
      expect(balanceAfter).to.equal(allocAmount);

      // Verify: owner preserved
      const owner = await subsidyV2.read.owner();
      expect(owner.toLowerCase()).to.equal(deployerAddr.toLowerCase());

      // Verify: phpcToken preserved
      const tokenAddr = await subsidyV2.read.phpcToken();
      expect(tokenAddr.toLowerCase()).to.equal(phpc.address.toLowerCase());
    });

    it("should expose new v2 function after upgrade", async function () {
      const { subsidy } = await deploySubsidySystem(deployer, viem);

      const newImpl = await viem.deployContract("PHPCSubsidyV2Mock", []);
      await subsidy.write.upgradeToAndCall([newImpl.address, "0x"]);

      const subsidyV2 = await viem.getContractAt(
        "PHPCSubsidyV2Mock",
        subsidy.address
      );

      // v2 adds a `version()` function
      const version = await subsidyV2.read.version();
      expect(version).to.equal(2n);
    });

    it("should still process transactions after upgrade", async function () {
      const { phpc, subsidy } = await deploySubsidySystem(deployer, viem);
      const deployerAddr = deployer.account!.address;
      const merchantAddr = user.account!.address;

      const beneficiaryId = keccak256(toBytes("post-upgrade-beneficiary"));
      const amount = parseUnits("100", 18);

      await phpc.write.mint([deployerAddr, amount]);
      await phpc.write.approve([subsidy.address, amount]);
      await subsidy.write.depositFunds([amount]);
      await subsidy.write.allocateCredits([beneficiaryId, amount]);

      // Upgrade to v2
      const newImpl = await viem.deployContract("PHPCSubsidyV2Mock", []);
      await subsidy.write.upgradeToAndCall([newImpl.address, "0x"]);
      const subsidyV2 = await viem.getContractAt(
        "PHPCSubsidyV2Mock",
        subsidy.address
      );

      const txId = keccak256(toBytes("post-upgrade-tx-001"));

      // Process transaction through v2
      await subsidyV2.write.processTransaction([
        beneficiaryId,
        merchantAddr,
        amount,
        txId,
      ]);

      // Verify beneficiary balance is zero
      const finalBalance = await subsidyV2.read.getBalance([beneficiaryId]);
      expect(finalBalance).to.equal(0n);

      // Verify merchant received PHPC
      const merchantBalance = await phpc.read.balanceOf([merchantAddr]);
      expect(merchantBalance).to.equal(amount);
    });
  });
});
