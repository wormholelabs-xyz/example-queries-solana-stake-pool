// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.19;

import "./libraries/BytesParsing.sol";
import "./libraries/QueryResponse.sol";

error InvalidAccount();           // 0x6d187b28
error InvalidAccountOwner();      // 0x36b1fa3a
error InvalidCommitmentLevel();   // 0xffe74dc8
error InvalidDataSlice();         // 0xf1b1ecf1
error InvalidForeignChainID();    // 0x4efe96a9
error UnexpectedDataLength();     // 0x9546c78e
error UnexpectedEpochMismatch();  // 0x1e0cfb5e
error UnexpectedResultLength();   // 0x3a279ba1
error UnexpectedResultMismatch(); // 0x1dd329af

contract StakePoolRate is QueryResponse {
    using BytesParsing for bytes;

    uint64 public totalActiveStake;
    uint64 public poolTokenSupply;
    uint64 public lastUpdateSolanaSlotNumber;
    uint64 public lastUpdateSolanaBlockTime;
    uint256 public calculatedRate;

    uint256 public immutable allowedUpdateStaleness;
    uint256 public immutable allowedRateStaleness;
    bytes32 public immutable stakePoolAccount;

    uint8 public constant RATE_SCALE = 18;
    uint16 public constant SOLANA_CHAIN_ID = 1;
    bytes12 public constant SOLANA_COMMITMENT_LEVEL = "finalized";
    // SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy https://spl.solana.com/stake-pool
    bytes32 public constant SOLANA_STAKE_POOL_PROGRAM = 0x06814ed4caf68a174672fdac86031a63e84ea15efa1d44b72293f6dbdb001650;
    // SysvarC1ock11111111111111111111111111111111 https://docs.solana.com/developing/runtime-facilities/sysvars#clock
    bytes32 public constant SOLANA_SYSVAR_CLOCK = 0x06a7d51718c774c928566398691d5eb68b5eb8a39b4b6d5c73555b2100000000;
    // https://github.com/solana-labs/solana-program-library/blob/b7dd8fee93815b486fce98d3d43d1d0934980226/stake-pool/program/src/state.rs#L87-L97
    uint64 public constant EXPECTED_DATA_OFFSET = 0;
    uint64 public constant STAKE_POOL_EXPECTED_DATA_LENGTH = 282;
    uint public constant STAKE_POOL_FIRST_FIELD_BYTE_IDX = 258;
    // https://docs.rs/solana-program/1.17.17/solana_program/clock/struct.Clock.html
    uint64 public constant SYSVAR_CLOCK_EXPECTED_DATA_LENGTH = 40;
    uint public constant SYSVAR_CLOCK_FIRST_FIELD_BYTE_IDX = 16;

    constructor(address _wormhole, bytes32 _stakePoolAccount, uint256 _allowedUpdateStaleness, uint256 _allowedRateStaleness) QueryResponse(_wormhole) {
        stakePoolAccount = _stakePoolAccount;
        allowedUpdateStaleness = _allowedUpdateStaleness;
        allowedRateStaleness = _allowedRateStaleness;
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

    function calculateRate(uint256 _totalActiveStake, uint256 _poolTokenSupply) public pure returns (uint256 v) {
        // scale the numerator so the decimal is shifted `RATE_SCALE` places
        // this should be safe for values less than 58 (the difference between u64 and u256 scales) as long as these source values are u64
        _totalActiveStake *= 10 ** RATE_SCALE;
        v = _totalActiveStake / _poolTokenSupply;
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
        if (s.requestDataSliceOffset != EXPECTED_DATA_OFFSET || s.requestDataSliceLength != STAKE_POOL_EXPECTED_DATA_LENGTH) {
            revert InvalidDataSlice();
        }
        if (s.results.length != 2) {
            revert UnexpectedResultLength();
        }
        if (s.results[0].account != stakePoolAccount) {
            revert InvalidAccount();
        }
        if (s.results[0].owner != SOLANA_STAKE_POOL_PROGRAM) {
            revert InvalidAccountOwner();
        }
        if (s.results[1].account != SOLANA_SYSVAR_CLOCK) {
            revert InvalidAccount();
        }
        validateBlockNum(s.slotNumber, lastUpdateSolanaSlotNumber);
        validateBlockTime(s.blockTime, allowedUpdateStaleness >= block.timestamp ? 0 : block.timestamp - allowedUpdateStaleness);
        if (s.results[0].data.length != STAKE_POOL_EXPECTED_DATA_LENGTH) {
            revert UnexpectedDataLength();
        }
        if (s.results[1].data.length != SYSVAR_CLOCK_EXPECTED_DATA_LENGTH) {
            revert UnexpectedDataLength();
        }
        uint64 _totalActiveStakeLE;
        uint64 _poolTokenSupplyLE;
        uint64 _lastUpdateEpochLE;
        uint64 _clockEpochLE;
        uint offset = STAKE_POOL_FIRST_FIELD_BYTE_IDX;
        (_totalActiveStakeLE, offset) = s.results[0].data.asUint64Unchecked(offset);
        (_poolTokenSupplyLE, offset) = s.results[0].data.asUint64Unchecked(offset);
        (_lastUpdateEpochLE, offset) = s.results[0].data.asUint64Unchecked(offset);
        offset = SYSVAR_CLOCK_FIRST_FIELD_BYTE_IDX;
        (_clockEpochLE, offset) = s.results[1].data.asUint64Unchecked(offset);
        if (_lastUpdateEpochLE != _clockEpochLE) {
            revert UnexpectedEpochMismatch();
        }

        totalActiveStake = reverse(_totalActiveStakeLE);
        poolTokenSupply = reverse(_poolTokenSupplyLE);

        lastUpdateSolanaSlotNumber = s.slotNumber;
        lastUpdateSolanaBlockTime = s.blockTime;

        // pre-calculate the rate once per update
        // according to testing, this saves ~578 gas on lookup but adds ~9076 gas to updates after the first
        // so, this should be a gain assuming > 16x more reads than updates
        calculatedRate = calculateRate(totalActiveStake, poolTokenSupply);
    }

    // @notice Returns the rate scaled to 1e18
    function getRate() public view returns (uint256) {
        validateBlockTime(lastUpdateSolanaBlockTime, allowedRateStaleness >= block.timestamp ? 0 : block.timestamp - allowedRateStaleness);
        return calculatedRate;
    }
}
