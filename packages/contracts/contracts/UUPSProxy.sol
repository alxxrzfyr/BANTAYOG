// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title UUPSProxy
 * @notice A wrapper contract for OpenZeppelin's ERC1967Proxy.
 *
 * @dev Since Hardhat only compiles Solidity files inside the contracts/ folder,
 *      we inherit from ERC1967Proxy to force compile it and generate the necessary
 *      artifacts for our deploy scripts and tests.
 *
 * BE2 owns this file.
 */
contract UUPSProxy is ERC1967Proxy {
    /**
     * @param _logic The address of the implementation contract.
     * @param _data  The initialization function call payload (encoded via encodeFunctionData).
     */
    constructor(
        address _logic,
        bytes memory _data
    ) payable ERC1967Proxy(_logic, _data) {}
}
