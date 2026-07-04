# Smart Contract Operations Guide

This document describes deployment, upgrades, and operational parameters for BANTAYOG smart contracts.

## Deployed Addresses

Contract addresses are configured inside `.env` in the root directory.

| Contract | Polygon Amoy Testnet |
|---|---|
| PHPC Token | *Configured on deploy* |
| PHPCSubsidy (Proxy) | *Configured on deploy* |
| BeneficiaryRegistry | *Configured on deploy* |
| MerchantRegistry | *Configured on deploy* |

## Compilation & Testing

Compile contracts from the root workspace directory:
```bash
pnpm --filter @bantayog/contracts compile
```

Run smart contract test suite:
```bash
pnpm --filter @bantayog/contracts test
```

## Deployment Steps

To deploy to Polygon Amoy Testnet:
1. Make sure your `.env` contains the correct `DEPLOYER_PRIVATE_KEY` and `POLYGON_AMOY_RPC_URL`.
2. Run the deployment script:
   ```bash
   pnpm deploy:contracts
   ```
   or directly via Hardhat:
   ```bash
   pnpm --filter @bantayog/contracts hardhat run scripts/deploy.ts --network amoy
   ```

## UUPS Upgrade Procedure

The `PHPCSubsidy` contract implements the UUPS upgradeability pattern. To perform a contract upgrade safely:

1. **Write V2 Contract**: Create the new implementation contract `PHPCSubsidyV2.sol` in `packages/contracts/contracts/`. Ensure all storage variable layouts exactly match the V1 contract to prevent storage slot collisions.
2. **Write Upgrade Script**: Create an upgrade script using OpenZeppelin Upgrades library:
   ```ts
   const PHPCSubsidyV2 = await ethers.getContractFactory("PHPCSubsidyV2");
   await upgrades.upgradeProxy(PROXY_ADDRESS, PHPCSubsidyV2);
   ```
3. **Execute Upgrade**: Run the script on the corresponding network.
