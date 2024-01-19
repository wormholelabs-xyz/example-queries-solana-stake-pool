// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.19;

import "./libraries/BytesParsing.sol";
import "./libraries/QueryResponse.sol";

error InvalidAccount();
error InvalidAccountOwner();
error InvalidCommitmentLevel();
error InvalidDataSlice();
error InvalidForeignChainID();
error UnexpectedDataLength();
error UnexpectedResultLength();
error UnexpectedResultMismatch();

contract StakePoolRate is QueryResponse {
    using BytesParsing for bytes;

    uint64 public totalActiveStake;
    uint64 public poolTokenSupply;
    uint64 public lastUpdateSolanaSlotNumber;
    uint64 public lastUpdateSolanaBlockTime;

    bytes32 public immutable stakePoolAccount;
    bytes32 public immutable stakePoolOwner;
    uint64 public immutable allowedStaleness;

    uint16 public constant SOLANA_CHAIN_ID = 1;
    bytes12 public constant SOLANA_COMMITMENT_LEVEL = "finalized";
    uint64 public constant EXPECTED_DATA_OFFSET = 258;
    uint64 public constant EXPECTED_DATA_LENGTH = 16;

    constructor(address _wormhole, bytes32 _stakePoolAccount, bytes32 _stakePoolOwner, uint64 _allowedStaleness) QueryResponse(_wormhole) {
        stakePoolAccount = _stakePoolAccount;
        stakePoolOwner = _stakePoolOwner;
        allowedStaleness = _allowedStaleness;
    }

    function reverse(uint64 input) public pure returns (uint64 v) {
        v = input;

        // swap bytes
        v = ((v & 0xFF00FF00FF00FF00) >> 8) |
            ((v & 0x00FF00FF00FF00FF) << 8);

        // swap 2-byte long pairs
        v = ((v & 0xFFFF0000FFFF0000) >> 16) |
            ((v & 0x0000FFFF0000FFFF) << 16);

        // swap 4-byte long pairs
        v = (v >> 32) | (v << 32);
    }

    // @notice Takes the cross chain query response for the stake pool on Solana and stores the result.
    function updatePool(bytes memory response, IWormhole.Signature[] memory signatures) public {
        ParsedQueryResponse memory r = parseAndVerifyQueryResponse(response, signatures);
        if (r.responses.length != 1) {
            revert UnexpectedResultLength();
        }
        if (r.responses[0].chainId != SOLANA_CHAIN_ID) {
            revert InvalidForeignChainID();
        }
        SolanaAccountQueryResponse memory s = parseSolanaAccountQueryResponse(r.responses[0]);
        if (s.requestCommitment.length > 12 || bytes12(s.requestCommitment) != SOLANA_COMMITMENT_LEVEL) {
            revert InvalidCommitmentLevel();
        }
        if (s.requestDataSliceOffset != EXPECTED_DATA_OFFSET || s.requestDataSliceLength != EXPECTED_DATA_LENGTH) {
            revert InvalidDataSlice();
        }
        if (s.results.length != 1) {
            revert UnexpectedResultLength();
        }
        if (s.results[0].account != stakePoolAccount) {
            revert InvalidAccount();
        }
        if (s.results[0].owner != stakePoolOwner) {
            revert InvalidAccountOwner();
        }
        validateBlockNum(s.slotNumber, lastUpdateSolanaSlotNumber);
        validateBlockTime(s.blockTime, block.timestamp - allowedStaleness);
        if (s.results[0].data.length != EXPECTED_DATA_LENGTH) {
            revert UnexpectedDataLength();
        }
        uint64 _totalActiveStakeLE;
        uint64 _poolTokenSupplyLE;
        uint offset = 0;
        (_totalActiveStakeLE, offset) = s.results[0].data.asUint64Unchecked(offset);
        (_poolTokenSupplyLE, offset) = s.results[0].data.asUint64Unchecked(offset);
        totalActiveStake = reverse(_totalActiveStakeLE);
        poolTokenSupply = reverse(_poolTokenSupplyLE);

        lastUpdateSolanaSlotNumber = s.slotNumber;
        lastUpdateSolanaBlockTime = s.blockTime;
    }

    function getRate() public view returns (uint64, uint64) {
        validateBlockTime(lastUpdateSolanaBlockTime, block.timestamp - allowedStaleness);
        return (totalActiveStake, poolTokenSupply);
    }
}
