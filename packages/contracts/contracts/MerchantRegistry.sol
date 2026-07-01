// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MerchantRegistry
 * @notice On-chain registry of verified Bantayog merchants (sari-sari stores).
 *
 * @dev Design:
 *   - Maps the merchant's Ronin wallet address to their verification status.
 *   - A `storeNameHash` (keccak256 of store name) enables off-chain integrity
 *     checks without exposing raw store data in a predictable format.
 *   - Only the contract owner (LGU admin / backend key) can register or
 *     change merchant status.
 *   - `isVerified()` is public so the PHPCSubsidy contract (and any future
 *     integrations) can check merchant eligibility before processing payments.
 *
 * Status lifecycle:
 *   PENDING → VERIFIED   (admin approves merchant)
 *   VERIFIED → SUSPENDED (admin suspends for violations)
 *   SUSPENDED → VERIFIED (admin reinstates)
 *   Any → DEREGISTERED   (permanent removal)
 *
 * BE2 owns this contract.
 */
contract MerchantRegistry is Ownable {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    enum MerchantStatus {
        NONE,          // 0 — default, not registered
        PENDING,       // 1 — registered but awaiting LGU verification
        VERIFIED,      // 2 — active verified merchant
        SUSPENDED,     // 3 — temporarily suspended
        DEREGISTERED   // 4 — permanently removed
    }

    struct MerchantEntry {
        /// @notice keccak256 of the store name for integrity checking.
        bytes32 storeNameHash;
        /// @notice Current registration/verification status.
        MerchantStatus status;
        /// @notice Block timestamp when this merchant was first registered.
        uint64 registeredAt;
        /// @notice keccak256(supabaseUUID) — opaque link back to off-chain record.
        bytes32 supabaseId;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Registry mapping: merchantWalletAddress → entry.
    mapping(address => MerchantEntry) private _registry;

    /// @notice Total number of currently verified (active) merchants.
    uint256 public verifiedCount;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event MerchantRegistered(
        address indexed merchantAddress,
        bytes32 supabaseId,
        bytes32 storeNameHash,
        uint64 registeredAt
    );

    event MerchantStatusChanged(
        address indexed merchantAddress,
        MerchantStatus oldStatus,
        MerchantStatus newStatus
    );

    event MerchantVerified(address indexed merchantAddress);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error AlreadyRegistered(address merchantAddress);
    error NotRegistered(address merchantAddress);
    error ZeroAddress();
    error InvalidStatusTransition(MerchantStatus current, MerchantStatus proposed);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address initialOwner) Ownable(initialOwner) {}

    // -------------------------------------------------------------------------
    // Write functions (owner-only)
    // -------------------------------------------------------------------------

    /**
     * @notice Registers a new merchant in PENDING status.
     *
     * @param merchantAddress  The merchant's Ronin wallet address.
     * @param supabaseId       keccak256(supabaseUUID) — opaque off-chain link.
     * @param storeNameHash    keccak256 of the store name string.
     */
    function register(
        address merchantAddress,
        bytes32 supabaseId,
        bytes32 storeNameHash
    ) external onlyOwner {
        if (merchantAddress == address(0)) revert ZeroAddress();

        MerchantEntry storage existing = _registry[merchantAddress];
        if (existing.status != MerchantStatus.NONE) {
            revert AlreadyRegistered(merchantAddress);
        }

        uint64 ts = uint64(block.timestamp);
        _registry[merchantAddress] = MerchantEntry({
            storeNameHash: storeNameHash,
            status: MerchantStatus.PENDING,
            registeredAt: ts,
            supabaseId: supabaseId
        });

        emit MerchantRegistered(merchantAddress, supabaseId, storeNameHash, ts);
    }

    /**
     * @notice Verifies (approves) a PENDING or SUSPENDED merchant.
     *
     * @param merchantAddress The merchant's Ronin wallet address.
     */
    function verify(address merchantAddress) external onlyOwner {
        MerchantEntry storage entry = _registry[merchantAddress];
        MerchantStatus current = entry.status;

        if (current == MerchantStatus.NONE) revert NotRegistered(merchantAddress);
        if (current == MerchantStatus.VERIFIED) {
            revert InvalidStatusTransition(current, MerchantStatus.VERIFIED);
        }
        if (current == MerchantStatus.DEREGISTERED) {
            revert InvalidStatusTransition(current, MerchantStatus.VERIFIED);
        }

        entry.status = MerchantStatus.VERIFIED;
        verifiedCount++;

        emit MerchantStatusChanged(merchantAddress, current, MerchantStatus.VERIFIED);
        emit MerchantVerified(merchantAddress);
    }

    /**
     * @notice Suspends a VERIFIED merchant.
     *
     * @param merchantAddress The merchant's Ronin wallet address.
     */
    function suspend(address merchantAddress) external onlyOwner {
        MerchantEntry storage entry = _registry[merchantAddress];
        if (entry.status != MerchantStatus.VERIFIED) {
            revert InvalidStatusTransition(entry.status, MerchantStatus.SUSPENDED);
        }

        entry.status = MerchantStatus.SUSPENDED;
        verifiedCount--;

        emit MerchantStatusChanged(merchantAddress, MerchantStatus.VERIFIED, MerchantStatus.SUSPENDED);
    }

    /**
     * @notice Permanently removes a merchant. Irreversible.
     *
     * @param merchantAddress The merchant's Ronin wallet address.
     */
    function deregister(address merchantAddress) external onlyOwner {
        MerchantEntry storage entry = _registry[merchantAddress];
        MerchantStatus current = entry.status;
        if (current == MerchantStatus.NONE) revert NotRegistered(merchantAddress);

        // Adjust count if previously verified
        if (current == MerchantStatus.VERIFIED) {
            verifiedCount--;
        }

        entry.status = MerchantStatus.DEREGISTERED;

        emit MerchantStatusChanged(merchantAddress, current, MerchantStatus.DEREGISTERED);
    }

    // -------------------------------------------------------------------------
    // Read functions (public)
    // -------------------------------------------------------------------------

    /**
     * @notice Returns true if the merchant is currently VERIFIED.
     *
     * @param merchantAddress The merchant's Ronin wallet address.
     */
    function isVerified(address merchantAddress) external view returns (bool) {
        return _registry[merchantAddress].status == MerchantStatus.VERIFIED;
    }

    /**
     * @notice Returns the full registry entry for a merchant.
     *
     * @param merchantAddress The merchant's Ronin wallet address.
     */
    function getEntry(
        address merchantAddress
    ) external view returns (MerchantEntry memory) {
        return _registry[merchantAddress];
    }

    /**
     * @notice Returns the current status of a merchant.
     *
     * @param merchantAddress The merchant's Ronin wallet address.
     */
    function getStatus(
        address merchantAddress
    ) external view returns (MerchantStatus) {
        return _registry[merchantAddress].status;
    }
}
