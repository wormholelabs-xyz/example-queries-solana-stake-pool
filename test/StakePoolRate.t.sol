// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import "../src/interfaces/IWormhole.sol";
import "../src/libraries/BytesParsing.sol";
import "../src/libraries/QueryResponse.sol";
import "../src/StakePoolRate.sol";
import {WormholeMock} from "./WormholeMock.t.sol";

contract CounterTest is Test {
    using BytesParsing for bytes;
    StakePoolRate public stakePoolRate;
    
    uint256 constant MOCK_GUARDIAN_PRIVATE_KEY = 0xcfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0;
    uint8 sigGuardianIndex = 0;

    uint64 THIRTY_MINUTES = 60*30;
    uint64 THIRTY_DAYS = 60*60*24*30;
    bytes32 mockPoolAccount = 0x048a3e08c3b495be17f45427d89bec5b80c7e2695c1864d76743db39bed346d6;

    // some happy case defaults
    bytes mockMainnetResponse = hex"010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000073010000002a01000104000000660000000966696e616c697a656400000000000000000000000000000000000000000000011a02048a3e08c3b495be17f45427d89bec5b80c7e2695c1864d76743db39bed346d606a7d51718c774c928566398691d5eb68b5eb8a39b4b6d5c73555b210000000001000104000001dd000000000e8a333900060fbc482645c089cb4c158a7c669dfe20bef457ae808d671dc9a32f28cbc4b1f0ad3d406ea9380200000000004e7b9000000000000000000006814ed4caf68a174672fdac86031a63e84ea15efa1d44b72293f6dbdb0016500000011a01451e3dd50d3b7b8536045c2b7ac2ec259473ebc25ae3bcbe1fbeb17d52fbc7be0d095d453d5883bfeeb42269657a79abd0ed08bb66f986591ce4f00f950bd5c85a1fcd5de2beec843fe794ddc95faf466d40451c9faa569e7822d92c7e6ae13afd23e07509baddedfdb516a90b9197bb504743255d0e37c5ff5dce8a241eedc4319ea768fedf644c8aae9b8e2188add06bc550fbf716c822b9ce63c7783d952e1ffcd141e9832caf10ad917495ca0f271b5b293cd47027ea737007ed40eb39a0bd09e6a3feecf99032e1c1df6b9722dcb3634e7b8e3440936bc34b0cc1c8eb521f06ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a9c2dba43ab1ac1800eb5e0a9753bf16003402000000000000000000000011d78000000000000001690006a7d5171875f729c73d93408f216120067ed88c76e08c287fc1946000000000000000283c338a0e000000002af7af65000000003402000000000000350200000000000021cdb16500000000";
    uint8 mockMainnetSigV = 0x1c;
    bytes32 mockMainnetSigR = 0x866bcea602aee0d95ab31dfff64c14382d2df83b2ff3a343a4167919b7e8dd90;
    bytes32 mockMainnetSigS = 0x6065842f565b72d99a4b3519ba9acb78992b7e1222d7dee8ccddce97176e701e;
    uint64 mockSlot = 243938105;
    uint64 mockBlockTime = 1706151199000000;
    uint64 mockTotalActiveStake = 6945276634127298;
    uint64 mockPoolTokenSupply = 6402815224864491;
    uint mockRate = 1084722327;
    
    function setUp() public {
        vm.warp(mockBlockTime/1_000_000);
        WormholeMock wormholeMock = new WormholeMock();
        stakePoolRate = new StakePoolRate(
            address(wormholeMock), 
            mockPoolAccount,
            THIRTY_MINUTES,
            THIRTY_DAYS
        );
    }

    function test_reverse_involutive(uint64 i) public {
        assertEq(stakePoolRate.reverse(stakePoolRate.reverse(i)), i);
    }

    function test_reverse() public {
        assertEq(stakePoolRate.reverse(0x0123456789ABCDEF), 0xEFCDAB8967452301);
    }

    function getSignature(bytes memory response) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 responseDigest = stakePoolRate.getResponseDigest(response);
        (v, r, s) = vm.sign(MOCK_GUARDIAN_PRIVATE_KEY, responseDigest);
    }

    function test_getSignature() public {
        (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(mockMainnetResponse);
        assertEq(sigV, mockMainnetSigV);
        assertEq(sigR, mockMainnetSigR);
        assertEq(sigS, mockMainnetSigS);
    }

    function test_valid_query() public {
        (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(mockMainnetResponse);
        IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
        signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: sigGuardianIndex});

        stakePoolRate.updatePool(mockMainnetResponse, signatures);
        assertEq(stakePoolRate.lastUpdateSolanaSlotNumber(), mockSlot);
        assertEq(stakePoolRate.lastUpdateSolanaBlockTime(), mockBlockTime);
        assertEq(stakePoolRate.totalActiveStake(), mockTotalActiveStake);
        assertEq(stakePoolRate.poolTokenSupply(), mockPoolTokenSupply);
        (uint64 _totalActiveStake, uint64 _poolTokenSupply) = stakePoolRate.getRate();
        assertEq(_totalActiveStake, mockTotalActiveStake);
        assertEq(_poolTokenSupply, mockPoolTokenSupply);
    }

    function test_stale_update_reverts() public {
        vm.warp((mockBlockTime/1_000_000)+THIRTY_DAYS);
        (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(mockMainnetResponse);
        IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
        signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: sigGuardianIndex});
        vm.expectRevert(StaleBlockTime.selector);
        stakePoolRate.updatePool(mockMainnetResponse, signatures);
    }

    function test_stale_rate_reverts() public {
        (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(mockMainnetResponse);
        IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
        signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: sigGuardianIndex});
        stakePoolRate.updatePool(mockMainnetResponse, signatures);
        vm.warp((mockBlockTime/1_000_000)+THIRTY_DAYS);
        stakePoolRate.getRate();
        vm.warp((mockBlockTime/1_000_000)+THIRTY_DAYS+1);
        vm.expectRevert(StaleBlockTime.selector);
        stakePoolRate.getRate();
    }

}
