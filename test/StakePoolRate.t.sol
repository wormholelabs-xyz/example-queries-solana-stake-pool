// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import "../src/libraries/BytesParsing.sol";
import {StakePoolRate} from "../src/StakePoolRate.sol";

contract CounterTest is Test {
    using BytesParsing for bytes;
    StakePoolRate public stakePoolRate;

    function setUp() public {
        stakePoolRate = new StakePoolRate(
            0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B, 
            bytes32(hex"048a3e08c3b495be17f45427d89bec5b80c7e2695c1864d76743db39bed346d6"),
            bytes32(hex"06814ed4caf68a174672fdac86031a63e84ea15efa1d44b72293f6dbdb001650"),
            60 * 60 * 6
        );
    }

    function test_reverse_involutive(uint64 i) public {
        assertEq(stakePoolRate.reverse(stakePoolRate.reverse(i)), i);
    }

    function test_reverse() public {
        assertEq(stakePoolRate.reverse(0x0123456789ABCDEF), 0xEFCDAB8967452301);
    }

    function test_parse() public {
        bytes memory data = hex"7716d32af5ef1700862b0144ff151600";
        uint64 totalActiveStake;
        uint64 poolTokenSupply;
        uint64 _totalActiveStakeLE;
        uint64 _poolTokenSupplyLE;
        uint offset = 0;
        (_totalActiveStakeLE, offset) = data.asUint64Unchecked(offset);
        (_poolTokenSupplyLE, offset) = data.asUint64Unchecked(offset);
        totalActiveStake = stakePoolRate.reverse(_totalActiveStakeLE);
        poolTokenSupply = stakePoolRate.reverse(_poolTokenSupplyLE);
        assertEq(totalActiveStake, 6737760728847991);
        assertEq(poolTokenSupply, 6216635589405574);
    }

    // function test_Increment() public {
    //     counter.increment();
    //     assertEq(counter.number(), 1);
    // }

    // function testFuzz_SetNumber(uint256 x) public {
    //     counter.setNumber(x);
    //     assertEq(counter.number(), x);
    // }
}
