## Queries Stake Pool Rate PoC

This is a demo of using [Wormhole Queries](https://wormhole.com/queries/) to provide a [Solana Stake Pool](https://spl.solana.com/stake-pool) rate on an EVM chain.

The tests use [Jito SOL](https://www.jito.network/) as an example, though the code is generally applicable to any Stake Pool account.

Learn more about developing with Queries in [the docs](https://docs.wormhole.com/wormhole/queries/getting-started).

## Contract

The oracle contract at [`./src/StakePoolRate.sol`](./src/StakePoolRate.sol) is an immutable [QueryResponse](https://github.com/wormhole-foundation/wormhole/blob/main/ethereum/contracts/query/QueryResponse.sol) processor, which accepts valid queries for the designated Stake Pool account via `updatePool()` and provides the last `totalActiveStake` and `poolTokenSupply` via `getRate()` as long as the last update is not older than the configured `allowedStaleness`.

### Constructor

- `address _wormhole` - The address of the Wormhole core contract on this chain. Used to verify guardian signatures.
- `bytes32 _stakePoolAccount` - The 32-byte address in hex of the Stake Pool account on Solana. Only queries for that account will be accepted, essentially making this a 1-1 mirror of that account (at least for the `totalActiveStake` and `poolTokenSupply` fields).
- `bytes32 _stakePoolOwner` - The 32-byte address in hex of the Stake Pool program on Solana (`SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy`). Only queries where this address is the owner of the account will be accepted.
- `uint64 _allowedStaleness` - The time in seconds behind the current block time for which updates will be accepted and rates are valid (i.e. `getRate` will not revert).

### updatePool

The `updatePool` method takes in the `response` and `signatures` from a Wormhole Query, performs validation, and updates the `lastUpdateSolanaSlotNumber`, `lastUpdateSolanaBlockTime`, `totalActiveStake`, and `poolTokenSupply` fields.

The validation includes

- Verifying the guardian signatures
- Parsing the query response
- Response only includes 1 result
- Response is for the Solana (Wormhole) chain id
- Request commitment level is for `finalized`
- Request data slice is for the [applicable fields](https://github.com/solana-labs/solana-program-library/blob/b7dd8fee93815b486fce98d3d43d1d0934980226/stake-pool/program/src/state.rs#L87-L94)
- Request account is the configured `stakePoolAccount`
- Response account's owner is the configured `stakePoolOwner`
- Response slot number is at least `lastUpdateSolanaSlotNumber`
- Response time is at least `block.timestamp - allowedStaleness`

### getRate

Returns the `totalActiveStake` and `poolTokenSupply` fields as long as the last updated time is not stale.

## Tests

### Unit Tests - Forge

[`./test/StakePoolRate.t.sol`](./test/StakePoolRate.t.sol) tests the `reverse` method of the contract, which converts the `u64` fields stored in the Solana account from little-endian (Borsch) to big-endian (Solidity)

#### Run

```bash
forge test
```

### Integration Tests - TypeScript

[`./ts-test/mock.ts`](./ts-test/mock.ts) performs fork testing by forking Ethereum mainnet, overriding the guardian set on the core contract, and mocking the Query Proxy / Guardian responses.

#### Setup

```bash
# Install dependencies
npm ci
# Generate bindings
forge build
npx typechain --target=ethers-v6 .\out\**\*.json
# Start anvil
anvil --fork-url https://ethereum.publicnode.com
# Override guardian set
npx @wormhole-foundation/wormhole-cli evm hijack -a 0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B -g 0xbeFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe
```

#### Run

```bash
npx tsx .\ts-test\mock.ts
```

## Deploy

The contract can be deployed with

```bash
forge create StakePoolRate --private-key <YOUR_PRIVATE_KEY> --constructor-args <WORMHOLE_CORE_BRIDGE_ADDRESS> <STAKE_POOL_ADDRESS_HEX> <STAKE_POOL_OWNER_HEX> <ALLOWED_STALENESS>
```

So the deploy corresponding to the above integration test might look like

```bash
forge create StakePoolRate --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --constructor-args 0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B 0x048a3e08c3b495be17f45427d89bec5b80c7e2695c1864d76743db39bed346d6 0x06814ed4caf68a174672fdac86031a63e84ea15efa1d44b72293f6dbdb001650 21600
```
