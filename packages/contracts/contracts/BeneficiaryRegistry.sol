// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BeneficiaryRegistry
 * @notice On-chain registry of enrolled Bantayog beneficiaries.
 *
 * @dev Privacy-first design:
 *   - No PII (names, addresses, birthdates) is stored on-chain.
 *   - Each beneficiary is identified by the keccak256 hash of their
 *     Supabase UUID, which is opaque on-chain.
 *   - A `dataHash` (keccak256 of canonical beneficiary JSON) provides
 *     integrity verification without exposing PII.
 *
 * Access control:
 *   - Only the contract owner (LGU admin / backend service key) can
 *     call `register()` and `deregister()`.
 *   - `isRegistered()` and `getEntry()` are public (read-only).
 *
 * BE2 owns this contract.
 */
contract BeneficiaryRegistry is Ownable {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct BeneficiaryEntry {
        /// @notice keccak256 hash of the beneficiary's canonical JSON record.
        ///         Used for off-chain integrity verification.
        bytes32 dataHash;
        /// @notice Intervention tier at time of registration (1 = Critical, 2 = Standard).
        uint8 tier;
        /// @notice Block timestamp when this beneficiary was registered.
        uint64 registeredAt;
        /// @notice True if the beneficiary is currently active in the program.
        bool active;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Registry mapping: keccak256(supabaseUUID) → entry.
    mapping(bytes32 => BeneficiaryEntry) private _registry;

    /// @notice Total number of currently active registered beneficiaries.
    uint256 public activeCount;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event BeneficiaryRegistered(
        bytes32 indexed beneficiaryId,
        bytes32 dataHash,
        uint8 tier,
        uint64 registeredAt
    );

    event BeneficiaryDeregistered(
        bytes32 indexed beneficiaryId,
        uint64 deregisteredAt
    );

    event BeneficiaryTierUpdated(
        bytes32 indexed beneficiaryId,
        uint8 oldTier,
        uint8 newTier
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error AlreadyRegistered(bytes32 beneficiaryId);
    error NotRegistered(bytes32 beneficiaryId);
    error InvalidTier(uint8 tier);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address initialOwner) Ownable(initialOwner) {}

    // -------------------------------------------------------------------------
    // Write functions (owner-only)
    // -------------------------------------------------------------------------

    /**
     * @notice Registers a new beneficiary on-chain.
     *
     * @param beneficiaryId  keccak256(supabaseUUID) — the opaque identifier.
     * @param dataHash       keccak256 of the canonical beneficiary JSON (off-chain record).
     * @param tier           Intervention tier: 1 = Critical (≤1000 days), 2 = Standard.
     */
    function register(
        bytes32 beneficiaryId,
        bytes32 dataHash,
        uint8 tier
    ) external onlyOwner {
        if (_registry[beneficiaryId].registeredAt != 0) {
            revert AlreadyRegistered(beneficiaryId);
        }
        if (tier != 1 && tier != 2) revert InvalidTier(tier);

        uint64 ts = uint64(block.timestamp);
        _registry[beneficiaryId] = BeneficiaryEntry({
            dataHash: dataHash,
            tier: tier,
            registeredAt: ts,
            active: true
        });
        activeCount++;

        emit BeneficiaryRegistered(beneficiaryId, dataHash, tier, ts);
    }

    /**
     * @notice Deregisters (soft-deletes) a beneficiary. Sets `active = false`.
     *
     * @param beneficiaryId keccak256 of the beneficiary's Supabase UUID.
     */
    function deregister(bytes32 beneficiaryId) external onlyOwner {
        BeneficiaryEntry storage entry = _registry[beneficiaryId];
        if (!entry.active) revert NotRegistered(beneficiaryId);

        entry.active = false;
        activeCount--;

        emit BeneficiaryDeregistered(beneficiaryId, uint64(block.timestamp));
    }

    /**
     * @notice Updates the on-chain tier for a beneficiary (e.g. after aging past 1,000 days).
     *
     * @param beneficiaryId keccak256 of the beneficiary's Supabase UUID.
     * @param newTier       New intervention tier (1 or 2).
     */
    function updateTier(bytes32 beneficiaryId, uint8 newTier) external onlyOwner {
        BeneficiaryEntry storage entry = _registry[beneficiaryId];
        if (!entry.active) revert NotRegistered(beneficiaryId);
        if (newTier != 1 && newTier != 2) revert InvalidTier(newTier);

        uint8 oldTier = entry.tier;
        entry.tier = newTier;

        emit BeneficiaryTierUpdated(beneficiaryId, oldTier, newTier);
    }

    // -------------------------------------------------------------------------
    // Read functions (public)
    // -------------------------------------------------------------------------

    /**
     * @notice Returns true if the beneficiary is currently active in the registry.
     *
     * @param beneficiaryId keccak256 of the beneficiary's Supabase UUID.
     */
    function isRegistered(bytes32 beneficiaryId) external view returns (bool) {
        return _registry[beneficiaryId].active;
    }

    /**
     * @notice Returns the full registry entry for a beneficiary.
     *
     * @param beneficiaryId keccak256 of the beneficiary's Supabase UUID.
     */
    function getEntry(
        bytes32 beneficiaryId
    ) external view returns (BeneficiaryEntry memory) {
        return _registry[beneficiaryId];
    }
}
