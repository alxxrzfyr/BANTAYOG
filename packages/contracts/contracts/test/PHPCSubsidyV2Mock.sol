// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PHPCSubsidy} from "../PHPCSubsidy.sol";

/**
 * @title PHPCSubsidyV2Mock
 * @notice A minimal v2 upgrade stub used exclusively in UUPS upgrade tests.
 *
 * @dev Extends PHPCSubsidy v1 with one new function (`version()`) to verify
 *      that the upgrade successfully changes the implementation while
 *      preserving all v1 state and functionality.
 *
 * DO NOT deploy to production. Test only.
 */
contract PHPCSubsidyV2Mock is PHPCSubsidy {
    /**
     * @notice Returns the contract version. Absent in v1, present in v2.
     *         Used by UUPS upgrade tests to confirm a successful upgrade.
     */
    function version() external pure returns (uint256) {
        return 2;
    }
}
