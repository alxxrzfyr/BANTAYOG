# Requirements Document

## Introduction

BANTAYOG currently integrates with a local Hardhat network for its blockchain, smart contract, and wallet flows. The local setup has produced recurring logic and connection errors, so the system is migrating its blockchain integration to the **Polygon Amoy testnet**. As part of this migration the system will deploy a mock **PHPC** ERC-20 token with an initial supply of 100,000 allocated to the LGU (admin) treasury wallet, allocate subsidy credits to beneficiaries by tier, auto-provision a custodial wallet for each beneficiary at registration, process PIN-authorized purchases in the merchant app, and expose a read-only balance/transaction view reachable by scanning the beneficiary's QR pass.

Based on clarification with the requester, the following decisions frame this spec:

- The target chain is **Polygon Amoy testnet (chainId 80002)**. **Ronin Wallet and Sky Mavis adapters (Tanto Connect, Waypoint) are dropped**; standard EVM wallets (MetaMask / injected EIP-1193) are used for admin/merchant connections.
- Beneficiary wallets are **custodial**: the backend generates and securely stores each beneficiary's EVM keypair. A beneficiary's PIN authorizes the backend to sign and deduct on their behalf.
- The balance-view link is **read-only** and authorized by the **signed token already embedded in the QR pass**; no PIN is required to view balance and transaction history.
- The 100,000 PHPC mock supply is **minted on deploy to the admin/LGU wallet**. Tier allocations are **one-time at registration**: Tier 1 = 5,000 PHPC, Tier 2 = 3,500 PHPC.
- Cleanup of unused local-Hardhat-only artifacts and dropped Ronin/Sky Mavis wallet code is **in scope** as an explicit requirement.

> **Open clarification (please confirm):** Your request mentioned "still utilizing Ronin wallet." Ronin is a separate Sky Mavis network, not Polygon Amoy, so it cannot be used directly on Amoy. This spec currently assumes custodial EVM wallets on Polygon Amoy with standard injected wallets for admin/merchant. If you specifically need Ronin Wallet/Ronin chain, this changes Requirements 1, 2, 5, and 6. See the note at the end of the message.

## Glossary

- **Polygon_Amoy**: The Polygon Amoy EVM testnet, chain ID 80002, reached over JSON-RPC.
- **Chain_Config**: The configuration set (network name, chain ID, RPC URL, deployer key, contract addresses) that directs the system to a target blockchain network.
- **Blockchain_Client**: The server-side component that establishes read (public) and write (wallet) connections to Polygon_Amoy and submits transactions.
- **PHPC_Token**: The mock ERC-20 token (symbol PHPC, 18 decimals) representing subsidy value on Polygon_Amoy.
- **LGU_Admin_Wallet**: The administrator (LGU treasury) EVM wallet that receives the initial PHPC_Token supply and owns the subsidy contracts.
- **PHPC_Subsidy_Contract**: The on-chain contract that holds subsidy funds, records per-beneficiary balances, and settles transactions.
- **Custodial_Wallet_Manager**: The backend component that generates, encrypts, stores, and retrieves per-beneficiary EVM keypairs.
- **Beneficiary_Wallet**: A custodial EVM wallet (address + backend-held key) auto-created for a beneficiary at registration.
- **Merchant_Wallet**: The EVM wallet address associated with a merchant that receives PHPC_Token on a completed purchase.
- **Admin_Portal**: The administrator-facing web application used to register beneficiaries and allocate credits.
- **Merchant_App**: The merchant-facing application used to scan a QR_Pass and complete a purchase.
- **QR_Pass**: The beneficiary's QR code containing a signed token that encodes beneficiary identity and wallet reference.
- **QR_Token**: The signed token (JWT) embedded in a QR_Pass.
- **Balance_View_Page**: The read-only public page that displays a beneficiary's current balance and transaction history when their QR_Pass is scanned.
- **PIN_Service**: The component that hashes and verifies a beneficiary's 6-digit PIN.
- **Tier_1**: Beneficiary classification receiving a one-time allocation of 5,000 PHPC.
- **Tier_2**: Beneficiary classification receiving a one-time allocation of 3,500 PHPC.
- **Transaction_Record**: A stored record of a credit allocation or a purchase, including amount, counterparty, timestamp, and on-chain transaction hash.

## Requirements

### Requirement 1: Migrate Blockchain Integration to Polygon Amoy

**User Story:** As a platform operator, I want the blockchain integration to target Polygon Amoy testnet, so that the system runs against a stable live testnet instead of the error-prone local Hardhat network.

#### Acceptance Criteria

1. THE Chain_Config SHALL define Polygon_Amoy with chain ID 80002 and a Polygon_Amoy JSON-RPC URL that is configurable via an environment variable and is a non-empty HTTP or HTTPS URL.
2. WHEN the Blockchain_Client initializes a read connection, THE Blockchain_Client SHALL connect to the Polygon_Amoy RPC URL defined in the Chain_Config within 30 seconds.
3. WHEN the Blockchain_Client initializes a write connection, THE Blockchain_Client SHALL use the deployer key defined in the Chain_Config and target chain ID 80002 within 30 seconds.
4. THE Chain_Config SHALL read the Polygon_Amoy RPC URL, deployer key, and contract addresses from environment variables.
5. IF a required Polygon_Amoy environment variable is missing when the Blockchain_Client initializes a connection, THEN THE Blockchain_Client SHALL abort the connection and raise an error that names the missing variable.
6. IF a chain read or write operation does not complete within 30 seconds or the connection is refused, THEN THE Blockchain_Client SHALL return an error result that identifies the failed operation and the target network without modifying any persisted state.
7. IF the network reached at the Polygon_Amoy RPC URL reports a chain ID other than 80002, THEN THE Blockchain_Client SHALL abort the connection and return an error that identifies the mismatched chain ID.
8. THE Chain_Config SHALL NOT reference chain ID 31337 or a local Hardhat network endpoint for runtime read or write operations.

### Requirement 2: Remove Unused Local-Hardhat and Ronin Wallet Artifacts

**User Story:** As a maintainer, I want unused local-Hardhat-only files and dropped Ronin/Sky Mavis wallet code removed, so that the codebase reflects the Polygon Amoy architecture and avoids confusion.

#### Acceptance Criteria

1. THE system SHALL remove the Ronin Wallet, Tanto Connect, and Waypoint wallet-adapter connection paths, including their import statements, dependency declarations, and configuration entries, from the wallet integration.
2. WHEN an injected EIP-1193 provider is exposed by the browser environment, THE wallet integration SHALL establish a standard EVM wallet connection through that provider.
3. THE system SHALL remove configuration entries and scripts whose sole purpose is targeting the local Hardhat network at chain ID 31337.
4. WHERE a removed file is referenced by remaining code, THE system SHALL update the referencing code so that the project build and type-check complete with zero unresolved-reference errors.
5. THE system SHALL retain files that are imported or executed by the Polygon_Amoy integration, tests, or contract deployment.
6. THE system SHALL ensure that zero runtime-code references to the removed Ronin/Sky Mavis wallet adapters or to chain ID 31337 remain in the codebase.
7. WHEN the automated test suite is executed, THE system SHALL complete the suite with zero test failures attributable to removed files or artifacts.

### Requirement 3: Deploy and Mint Mock PHPC Supply to the Admin Wallet

**User Story:** As an LGU administrator, I want a mock PHPC token deployed on Polygon Amoy with 100,000 units minted to the admin wallet, so that the treasury has funds to allocate to beneficiaries.

#### Acceptance Criteria

1. WHEN the deployment process runs against Polygon_Amoy, THE system SHALL deploy the PHPC_Token contract to Polygon_Amoy, confirm the deployment transaction on-chain, and verify that contract bytecode exists at the deployed address before proceeding.
2. IF the PHPC_Token contract deployment transaction fails or is not confirmed on-chain, THEN THE system SHALL abort the deployment process, report a deployment failure indicating the contract was not deployed, and produce no deployed contract addresses.
3. WHEN the PHPC_Token contract deployment is confirmed on-chain, THE system SHALL mint exactly 100,000 PHPC (100,000 × 10^18 base units) to the LGU_Admin_Wallet and confirm the mint transaction on-chain.
4. IF the mint transaction fails or is not confirmed on-chain, THEN THE system SHALL report a mint failure indicating no supply was minted to the LGU_Admin_Wallet and leave the LGU_Admin_Wallet PHPC_Token balance unchanged.
5. THE PHPC_Token SHALL represent amounts using exactly 18 decimals.
6. WHEN the deployment process completes, THE system SHALL output the deployed PHPC_Token address and the PHPC_Subsidy_Contract address, each as a valid EVM address.
7. WHILE the LGU_Admin_Wallet holds the initial supply and no allocations have been made, THE system SHALL report the LGU_Admin_Wallet PHPC_Token balance as exactly 100,000 PHPC (100,000 × 10^18 base units).

### Requirement 4: Allocate Tier-Based Credits to Beneficiaries

**User Story:** As an LGU administrator, I want beneficiaries to receive tier-based PHPC credits, so that eligible families get their subsidy amounts.

#### Acceptance Criteria

1. WHEN an LGU administrator initiates allocation for a beneficiary classified as Tier 1 who has no prior allocation, THE System SHALL credit exactly 5,000.00 PHPC to that beneficiary's balance by setting the beneficiary's balance to the beneficiary's current balance plus 5,000.00 PHPC.
2. WHEN an LGU administrator initiates allocation for a beneficiary classified as Tier 2 who has no prior allocation, THE System SHALL credit exactly 3,500.00 PHPC to that beneficiary's balance by setting the beneficiary's balance to the beneficiary's current balance plus 3,500.00 PHPC, and THE System SHALL allocate exactly 3,500.00 PHPC from the treasury as part of this update.
3. WHEN an allocation is successfully credited, THE System SHALL increase the beneficiary's balance by the tier-based amount and decrease the treasury balance by the same amount.
4. IF the treasury balance is less than the tier-based allocation amount at the time of allocation, THEN THE System SHALL reject the allocation, leave the treasury balance and the beneficiary balance unchanged, and return an error indication that the treasury has insufficient funds.
5. WHEN an allocation is successfully credited, THE System SHALL record a Transaction_Record containing the beneficiary identifier, the allocated amount, the tier classification, and the allocation timestamp.
6. IF reconciliation between the recorded allocation and the on-chain balance detects a mismatch, THEN THE System SHALL flag the allocation as unreconciled and return an error indication identifying the mismatched allocation.
7. IF an allocation is initiated for a beneficiary that already has a prior allocation, THEN THE System SHALL reject the allocation, leave the beneficiary balance and the treasury balance unchanged, and return an error indication that a duplicate allocation was attempted.
8. IF the on-chain allocation transaction fails or does not confirm within 60 seconds, THEN THE System SHALL abort the allocation, leave the beneficiary balance and the treasury balance unchanged, and return an error indication that the on-chain allocation could not be completed.
9. IF an allocation is initiated for a beneficiary whose tier classification is not Tier 1 or Tier 2, THEN THE System SHALL reject the allocation, leave the beneficiary balance and the treasury balance unchanged, and return an error indication that the tier classification is invalid.

### Requirement 5: Auto-Generate a Custodial Wallet at Beneficiary Registration

**User Story:** As an LGU administrator, I want each beneficiary to get a wallet automatically at registration embedded in their QR pass, so that beneficiaries can transact without installing a wallet app.

#### Acceptance Criteria

1. WHEN a beneficiary is registered in the Admin_Portal, THE Custodial_Wallet_Manager SHALL generate an EVM keypair for that beneficiary within 10 seconds of the registration request being accepted.
2. WHEN a Beneficiary_Wallet is generated, THE Custodial_Wallet_Manager SHALL store the private key in encrypted form before the Admin_Portal reports registration success.
3. THE Custodial_Wallet_Manager SHALL associate exactly one Beneficiary_Wallet address with each beneficiary, and that address SHALL be globally unique across all beneficiaries.
4. IF a newly generated Beneficiary_Wallet address matches an address already associated with any existing beneficiary, THEN THE Custodial_Wallet_Manager SHALL retry keypair generation up to 3 attempts, and if a unique address is not obtained within those attempts SHALL treat wallet generation as failed.
5. WHEN a beneficiary's QR_Pass is generated, THE system SHALL embed within the signed QR_Token a Beneficiary_Wallet address reference that resolves to the beneficiary's stored Beneficiary_Wallet address.
6. IF wallet generation fails during registration, THEN THE Admin_Portal SHALL abort the registration, persist no beneficiary record and no partial wallet data, and return an error indicating that the beneficiary was not created.

### Requirement 6: Secure Custody of Beneficiary Keys

**User Story:** As a security-conscious operator, I want beneficiary private keys protected, so that custodial funds cannot be extracted from stored data.

#### Acceptance Criteria

1. THE Custodial_Wallet_Manager SHALL store each Beneficiary_Wallet private key only in encrypted form, SHALL NOT persist any Beneficiary_Wallet private key in plaintext, and SHALL encrypt it at rest using an encryption key that is stored separately from the encrypted data.
2. WHEN the backend needs to sign a beneficiary transaction, THE Custodial_Wallet_Manager SHALL decrypt the private key only in server-side memory for the duration of the signing operation.
3. WHEN a beneficiary transaction signing operation completes, whether it succeeds or fails, THE Custodial_Wallet_Manager SHALL erase the decrypted private key from server-side memory before returning control to the caller.
4. IF decryption of a Beneficiary_Wallet private key fails, THEN THE Custodial_Wallet_Manager SHALL abort the signing operation, SHALL retain the stored encrypted private key unchanged, SHALL return an error response indicating the signing operation could not be completed, and SHALL exclude both the encrypted and decrypted key material from that error response.
5. THE system SHALL exclude Beneficiary_Wallet private keys, in both their encrypted and decrypted forms, from all API responses, logs, and client-facing pages.

### Requirement 7: Process PIN-Authorized Purchases in the Merchant App

**User Story:** As a beneficiary, I want to pay a merchant by scanning my pass and entering my PIN, so that the purchase amount is deducted from my subsidy balance.

#### Acceptance Criteria

1. WHEN a merchant scans a QR_Pass in the Merchant_App whose QR_Token signature is valid and not expired, THE system SHALL resolve the associated beneficiary and Beneficiary_Wallet.
2. IF a merchant scans a QR_Pass whose QR_Token signature is invalid or expired, THEN THE system SHALL reject the purchase and report that the pass is invalid, without resolving a beneficiary or Beneficiary_Wallet.
3. WHEN a beneficiary submits a 6-digit PIN for a purchase, THE PIN_Service SHALL verify the submitted PIN against the stored beneficiary PIN hash.
4. IF the submitted PIN does not match the stored PIN hash, THEN THE system SHALL reject the purchase, report an authentication failure, and leave the beneficiary's recorded balance unchanged.
5. IF a beneficiary submits an incorrect PIN on 5 consecutive attempts for a purchase, THEN THE system SHALL block further purchase PIN attempts for that beneficiary for 900 seconds and report that the account is temporarily locked.
6. WHEN a purchase is PIN-authorized and the purchase amount is less than or equal to the beneficiary's recorded balance, THE system SHALL deduct the purchase amount from the beneficiary's recorded balance and transfer the equivalent PHPC to the Merchant_Wallet.
7. IF the purchase amount exceeds the beneficiary's recorded balance, THEN THE system SHALL reject the purchase, report insufficient balance, and leave the beneficiary's recorded balance unchanged.
8. WHEN a purchase is processed successfully on-chain, THE system SHALL persist a Transaction_Record that includes the beneficiary reference, Merchant_Wallet, purchase amount, on-chain transaction hash, and timestamp.
9. IF the purchase amount is less than or equal to zero, THEN THE system SHALL reject the purchase and report an invalid amount.
10. IF the on-chain PHPC transfer fails after the beneficiary's recorded balance was deducted, THEN THE system SHALL restore the beneficiary's recorded balance, record the discrepancy for manual reconciliation, and report that the purchase failed.

### Requirement 8: Read-Only Balance and Transaction View via QR Pass

**User Story:** As a beneficiary, I want to scan my pass to see my current balance and transactions, so that I can check my subsidy without logging in.

#### Acceptance Criteria

1. WHEN a QR_Pass is scanned for balance viewing, THE system SHALL open the Balance_View_Page for the beneficiary encoded in the QR_Token within 3 seconds of the scanned QR_Token being decoded.
2. WHEN the Balance_View_Page loads with a valid QR_Token, THE Balance_View_Page SHALL display the beneficiary's current balance and the beneficiary's transaction history ordered from most recent to oldest, up to a maximum of 50 Transaction_Record entries.
3. THE Balance_View_Page SHALL authorize access using the signed QR_Token without requiring a PIN.
4. THE Balance_View_Page SHALL restrict displayed data to the single beneficiary encoded in the QR_Token.
5. THE Balance_View_Page SHALL present balance and transaction data as read-only, exposing no controls or actions that create, modify, or deduct balances.
6. IF the QR_Token signature is invalid or expired, THEN THE Balance_View_Page SHALL deny access, withhold all balance and transaction data, and display a message indicating that the pass is invalid.
7. IF the QR_Token is valid but no beneficiary or Beneficiary_Wallet can be resolved from it, THEN THE Balance_View_Page SHALL deny access, withhold all balance and transaction data, and display a message indicating that the pass cannot be matched to a beneficiary.
8. IF retrieval of the beneficiary's balance or transaction history fails, THEN THE Balance_View_Page SHALL withhold partial data and display a message indicating that balance information is temporarily unavailable.

### Requirement 9: QR Token Signing and Verification Integrity

**User Story:** As a developer, I want QR tokens to sign and verify reliably, so that passes are trustworthy and tamper-evident across generation and scanning.

#### Acceptance Criteria

1. WHEN a QR_Token is generated, THE system SHALL sign the token payload with the configured secret and embed an expiration timestamp set to the configured token time-to-live (defaulting to 300 seconds when no time-to-live is configured).
2. WHEN a QR_Token is verified, THE system SHALL accept the QR_Token only if its signature matches the value computed from the configured secret AND its embedded expiration timestamp is greater than the current system time.
3. WHEN a QR_Token generated from a valid beneficiary payload is subsequently verified, THE system SHALL return the same beneficiary identity and Beneficiary_Wallet reference that were encoded at generation time (round-trip property).
4. IF a QR_Token payload is modified after signing, THEN THE system SHALL reject the QR_Token, return an error indicating an invalid signature, and return no beneficiary identity or Beneficiary_Wallet reference.
5. IF a QR_Token's signature does not match the value computed from the configured secret, THEN THE system SHALL reject the QR_Token and return an error indicating an invalid signature.
6. IF a QR_Token's embedded expiration timestamp is less than or equal to the current system time, THEN THE system SHALL reject the QR_Token and return an error indicating that the token has expired.

### Requirement 10: Configuration and Secrets Management for Polygon Amoy

**User Story:** As an operator, I want all Polygon Amoy connection settings and contract addresses configured through environment variables, so that deployment targets and secrets are managed without code changes.

#### Acceptance Criteria

1. THE Chain_Config SHALL source the Polygon_Amoy RPC URL, deployer key, LGU_Admin_Wallet address, PHPC_Token address, and PHPC_Subsidy_Contract address from environment variables.
2. THE system SHALL provide an environment variable template that enumerates by name every Polygon_Amoy configuration variable required to run the system (RPC URL, deployer key, LGU_Admin_Wallet address, PHPC_Token address, and PHPC_Subsidy_Contract address), where every secret-bearing variable contains only a non-functional placeholder value and no real secret value.
3. IF the configured deployer key is not a valid EVM private key, OR any configured contract or wallet address is not a 0x-prefixed 40-hexadecimal-character EVM address, THEN THE Blockchain_Client SHALL raise an error that identifies each invalid variable by name and SHALL NOT establish a write connection to Polygon_Amoy.
4. THE system SHALL exclude the deployer key, Beneficiary_Wallet private keys, QR_Token signing secret, and key-encryption keys from all client-facing responses and logs, such that any occurrence of these values is redacted and not observable in response bodies or log output.
5. WHEN the Blockchain_Client establishes a write connection, IF any required Polygon_Amoy configuration variable is missing, empty, or fails format validation, THEN THE system SHALL abort establishing that write connection, name every offending variable, and SHALL NOT apply any partial configuration.
