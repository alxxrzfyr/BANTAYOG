// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PHPCSubsidy
 * @notice UUPS-upgradeable contract that manages the Bantayog subsidy program.
 *
 * @dev Responsibilities:
 *   1. Holds PHPC tokens allocated by the LGU treasury.
 *   2. Tracks per-beneficiary credit balances (off-chain DB is the primary
 *      source of truth; on-chain provides auditability).
 *   3. Allocates credits to beneficiaries via `allocateCredits()`.
 *   4. Processes subsidy payments from beneficiary to merchant via
 *      `processTransaction()`.
 *
 * Security:
 *   - Only the contract owner (LGU admin / backend service key) can call
 *     `allocateCredits` and `processTransaction`.
 *   - UUPS upgrade is gated by `_authorizeUpgrade` (owner-only).
 *   - Uses SafeERC20 for all token operations to handle non-standard ERC-20s.
 *
 * UUPS Pattern:
 *   - Deploy this contract behind an ERC1967Proxy using OpenZeppelin's
 *     `Upgrades.deployUUPSProxy()` (Hardhat Ignition) or the deploy script.
 *   - Call `initialize()` once on the proxy — NOT on the implementation.
 *
 * BE2 owns this contract.
 */
contract PHPCSubsidy is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // State variables
    // -------------------------------------------------------------------------

    /// @notice The PHPC ERC-20 token contract address.
    IERC20 public phpcToken;

    /// @notice On-chain credit balance per beneficiary ID (bytes32 = keccak256 of UUID).
    /// @dev The off-chain Supabase DB is the primary source; this mirrors allocations
    ///      for audit trail and final payment settlement.
    mapping(bytes32 => uint256) public beneficiaryBalance;

    /// @notice Total PHPC allocated to the subsidy pool (informational).
    uint256 public totalAllocated;

    /// @notice Total PHPC paid out in processed transactions (informational).
    uint256 public totalPaidOut;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when credits are allocated to a beneficiary.
    event CreditsAllocated(
        bytes32 indexed beneficiaryId,
        uint256 amount,
        uint256 newBalance
    );

    /// @notice Emitted when a subsidy transaction is processed.
    event TransactionProcessed(
        bytes32 indexed beneficiaryId,
        address indexed merchantAddress,
        uint256 amount,
        bytes32 transactionId
    );

    /// @notice Emitted when PHPC is deposited into this contract.
    event FundsDeposited(address indexed from, uint256 amount);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error InsufficientBeneficiaryBalance(
        bytes32 beneficiaryId,
        uint256 requested,
        uint256 available
    );
    error InsufficientContractBalance(uint256 requested, uint256 available);
    error ZeroAmount();
    error ZeroAddress();

    // -------------------------------------------------------------------------
    // Constructor (disables initializers for the implementation contract)
    // -------------------------------------------------------------------------

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // -------------------------------------------------------------------------
    // Initializer (called once on the proxy after deployment)
    // -------------------------------------------------------------------------

    /**
     * @notice Initializes the proxy. Must be called exactly once after deployment.
     *
     * @param _phpcToken    The deployed PHPC ERC-20 token address.
     * @param initialOwner  The LGU admin address that owns and controls this contract.
     */
    function initialize(
        address _phpcToken,
        address initialOwner
    ) external initializer {
        if (_phpcToken == address(0)) revert ZeroAddress();
        if (initialOwner == address(0)) revert ZeroAddress();

        __Ownable_init(initialOwner);

        phpcToken = IERC20(_phpcToken);
    }

    // -------------------------------------------------------------------------
    // Deposit (anyone can top up the pool, but only owner allocates)
    // -------------------------------------------------------------------------

    /**
     * @notice Deposits PHPC into this contract to fund the subsidy pool.
     * @dev Caller must have approved this contract to spend `amount` PHPC first.
     *
     * @param amount The amount of PHPC (in wei) to deposit.
     */
    function depositFunds(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();

        phpcToken.safeTransferFrom(msg.sender, address(this), amount);
        totalAllocated += amount;

        emit FundsDeposited(msg.sender, amount);
    }

    // -------------------------------------------------------------------------
    // Core subsidy operations (owner-only)
    // -------------------------------------------------------------------------

    /**
     * @notice Allocates PHPC credits to a beneficiary.
     * @dev Called by the LGU backend service after an admin tops up a beneficiary
     *      via the Admin Website. The funds must already be in this contract
     *      (deposited via `depositFunds`).
     *
     * @param beneficiaryId  keccak256 hash of the beneficiary's UUID from Supabase.
     * @param amount         Amount of PHPC credits to allocate (in wei).
     */
    function allocateCredits(
        bytes32 beneficiaryId,
        uint256 amount
    ) external onlyOwner {
        if (amount == 0) revert ZeroAmount();

        uint256 contractBal = phpcToken.balanceOf(address(this));
        uint256 newBeneficiaryBal = beneficiaryBalance[beneficiaryId] + amount;

        // Ensure contract has enough PHPC to back the allocation
        if (contractBal < amount) {
            revert InsufficientContractBalance(amount, contractBal);
        }

        beneficiaryBalance[beneficiaryId] = newBeneficiaryBal;

        emit CreditsAllocated(beneficiaryId, amount, newBeneficiaryBal);
    }

    /**
     * @notice Processes a subsidy purchase: deducts from beneficiary's balance
     *         and transfers PHPC to the merchant.
     * @dev Called by the LGU backend service after the merchant completes
     *      checkout and PIN verification. The `transactionId` is the keccak256
     *      of the Supabase transaction UUID, used for deduplication/audit.
     *
     * @param beneficiaryId    keccak256 of the beneficiary's Supabase UUID.
     * @param merchantAddress  The merchant's Ronin wallet address.
     * @param amount           Amount of PHPC to transfer (in wei).
     * @param transactionId    keccak256 of the Supabase transaction UUID.
     */
    function processTransaction(
        bytes32 beneficiaryId,
        address merchantAddress,
        uint256 amount,
        bytes32 transactionId
    ) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (merchantAddress == address(0)) revert ZeroAddress();

        uint256 available = beneficiaryBalance[beneficiaryId];
        if (available < amount) {
            revert InsufficientBeneficiaryBalance(beneficiaryId, amount, available);
        }

        // Deduct from beneficiary
        unchecked {
            beneficiaryBalance[beneficiaryId] = available - amount;
        }
        totalPaidOut += amount;

        // Transfer PHPC to merchant
        phpcToken.safeTransfer(merchantAddress, amount);

        emit TransactionProcessed(
            beneficiaryId,
            merchantAddress,
            amount,
            transactionId
        );
    }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    /**
     * @notice Returns the contract's total PHPC balance (unallocated + allocated pool).
     */
    function contractPHPCBalance() external view returns (uint256) {
        return phpcToken.balanceOf(address(this));
    }

    /**
     * @notice Returns the credit balance for a specific beneficiary.
     * @param beneficiaryId keccak256 of the beneficiary's UUID.
     */
    function getBalance(bytes32 beneficiaryId) external view returns (uint256) {
        return beneficiaryBalance[beneficiaryId];
    }

    // -------------------------------------------------------------------------
    // UUPS upgrade authorization
    // -------------------------------------------------------------------------

    /**
     * @dev Only the owner can authorize an upgrade. Called by the UUPS proxy
     *      during `upgradeToAndCall()`.
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
