// only query (up to) the required three fields
// https://github.com/solana-labs/solana-program-library/blob/b7dd8fee93815b486fce98d3d43d1d0934980226/stake-pool/program/src/state.rs#L87-L97
// and the Clock sysvar data for comparing the epoch
// https://docs.solana.com/developing/runtime-facilities/sysvars#clock
// https://docs.rs/solana-program/1.17.17/solana_program/clock/struct.Clock.html
// Solana's getMultipleAccounts rpc spec only allows setting one data slice for all of the accounts, so this will result in some extra bytes
// https://docs.solana.com/api/http#getmultipleaccounts
// This could also be done in two per-chain queries, though then it may not be done in the same batch call.
export const FIRST_FIELD_BYTE_IDX = 258;
export const SIZE_OF_U64 = 8;
export const DATA_SLICE_OFFSET = 0;
export const DATA_SLICE_LENGTH = FIRST_FIELD_BYTE_IDX + SIZE_OF_U64 * 3;
