# Smart Contract Operations Guide

This document describes deployment, upgrades, and operational parameters for BANTAYOG smart contracts.

## Deployed Addresses

Contract addresses are configured inside `.env` in the root directory.

| Contract | Local Hardhat | Ronin Saigon Testnet |
|---|---|---|
| PHPC Token | `0xe7f1725e7734ce288f8367e1bb143e90bb3f0512` | *Configured on deploy* |
| PHPCSubsidy (Proxy) | `0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9` | *Configured on deploy* |
| BeneficiaryRegistry | `0xdc64a140aa3e981100a9beca4e685f962f0cf6c9` | *Configured on deploy* |
| MerchantRegistry | `0x5fc8d32690cc91d4c39d9d3abcbd16989f875707` | *Configured on deploy* |

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

To deploy all contracts on the local node:
1. Start the Hardhat Node:
   ```bash
   pnpm --filter @bantayog/contracts hardhat node
   ```
2. Run the deployment script:
   ```bash
   pnpm deploy:contracts
   ```

To deploy to Ronin Saigon Testnet:
1. Make sure your `.env` contains the correct `DEPLOYER_PRIVATE_KEY` and Saigon RPC URL.
2. Run the Hardhat deploy command:
   ```bash
   pnpm --filter @bantayog/contracts hardhat run scripts/deploy.ts --network saigon
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
