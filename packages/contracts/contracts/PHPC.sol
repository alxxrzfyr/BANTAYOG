// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PHPC — Philippine Peso Coin
 * @notice ERC-20 stablecoin representing Philippine Peso value (1 PHPC = 1 PHP).
 *
 * @dev Design decisions:
 *   - Mint is restricted to the contract owner (the LGU treasury multi-sig or admin key).
 *   - Burn is inherited from ERC20Burnable and available to any token holder (for their own tokens).
 *   - Standard 18-decimal precision inherited from OpenZeppelin ERC20.
 *   - No pause or blacklist in v1 — upgrade to PHPCSubsidy (UUPS proxy) handles
 *     any emergency freeze at the subsidy layer rather than at the token layer.
 *
 * Ownership:
 *   - On deploy, owner = deployer (LGU admin EOA or Gnosis Safe).
 *   - Transfer ownership to a multi-sig after initial mint per ADR-0001.
 *
 * BE2 owns this contract.
 */
contract PHPC is ERC20, ERC20Burnable, Ownable {
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when new PHPC tokens are minted by the owner.
    event Minted(address indexed to, uint256 amount);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param initialOwner The address that will own the contract and have minting rights.
     *                     Typically the LGU treasury address or a Gnosis Safe.
     */
    constructor(
        address initialOwner
    ) ERC20("Philippine Peso Coin", "PHPC") Ownable(initialOwner) {}

    // -------------------------------------------------------------------------
    // Mint (owner-only)
    // -------------------------------------------------------------------------

    /**
     * @notice Mints `amount` PHPC tokens to `to`.
     * @dev Only callable by the contract owner (LGU). Used to top up the
     *      PHPCSubsidy contract with subsidy funds.
     *
     * @param to     Recipient of the newly minted tokens.
     * @param amount Number of tokens to mint (in wei, 18 decimals).
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        emit Minted(to, amount);
    }

    // -------------------------------------------------------------------------
    // Decimals
    // -------------------------------------------------------------------------

    /**
     * @notice Returns the number of decimals. Overridden for clarity; value is 18
     *         (same as ERC20 default).
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
