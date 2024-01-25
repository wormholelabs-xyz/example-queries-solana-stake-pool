## Queries Stake Pool Rate PoC

This is a demo of using [Wormhole Queries](https://wormhole.com/queries/) to provide a [Solana Stake Pool](https://spl.solana.com/stake-pool) rate on an EVM chain.

The tests use [Jito SOL](https://www.jito.network/) as an example, though the code is generally applicable to any Stake Pool account.

Learn more about developing with Queries in [the docs](https://docs.wormhole.com/wormhole/queries/getting-started).

## Contract

The oracle contract at [`./src/StakePoolRate.sol`](./src/StakePoolRate.sol) is an immutable [QueryResponse](https://github.com/wormhole-foundation/wormhole/blob/main/ethereum/contracts/query/QueryResponse.sol) processor, which accepts valid queries for the designated Stake Pool account via `updatePool()` and provides the last `totalActiveStake` and `poolTokenSupply` via `getRate()` as long as the last update is not older than the configured `allowedStaleness`.

### Constructor

- `address _wormhole` - The address of the Wormhole core contract on this chain. Used to verify guardian signatures.
- `bytes32 _stakePoolAccount` - The 32-byte address in hex of the Stake Pool account on Solana. Only queries for that account will be accepted, essentially making this a 1-1 mirror of that account (at least for the `totalActiveStake` and `poolTokenSupply` fields).
- `uint64 _allowedStaleness` - The time in seconds behind the current block time for which updates will be accepted and rates are valid (i.e. `getRate` will not revert).

### updatePool

The `updatePool` method takes in the `response` and `signatures` from a Wormhole Query, performs validation, and updates the `lastUpdateSolanaSlotNumber`, `lastUpdateSolanaBlockTime`, `totalActiveStake`, and `poolTokenSupply` fields.

The validation includes

- Verifying the guardian signatures
- Parsing the query response
- Response includes exactly 2 results
- Response is for the Solana (Wormhole) chain id
- Request commitment level is for `finalized`
- Request data slice is for the [applicable fields](https://github.com/solana-labs/solana-program-library/blob/b7dd8fee93815b486fce98d3d43d1d0934980226/stake-pool/program/src/state.rs#L87-L94)
- Request account 0 is the configured `stakePoolAccount`
- Response account 0's owner is Stake Pool program (`SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy`)
- Request account 1 is the Clock account (`SysvarC1ock11111111111111111111111111111111`)
- Response slot number is at least `lastUpdateSolanaSlotNumber`
- Response time is at least `block.timestamp - allowedStaleness`
- The last update epoch from the stake pool account matches the current epoch in the Clock account

### getRate

Returns the `totalActiveStake` and `poolTokenSupply` fields as long as the last updated time is not stale.

## Tests

### Unit Tests - Forge

[`./test/StakePoolRate.t.sol`](./test/StakePoolRate.t.sol) tests the following

- `reverse` method of the contract, which converts the `u64` fields stored in the Solana account from little-endian (Borsch) to big-endian (Solidity)
- `updatePool` positive test case, in which submitting a valid query updates the fields accordingly

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
forge create StakePoolRate --private-key <YOUR_PRIVATE_KEY> --constructor-args <WORMHOLE_CORE_BRIDGE_ADDRESS> <STAKE_POOL_ADDRESS_HEX> <ALLOWED_STALENESS>
```

So the deploy corresponding to the above integration test might look like

```bash
forge create StakePoolRate --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --constructor-args 0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B 0x048a3e08c3b495be17f45427d89bec5b80c7e2695c1864d76743db39bed346d6 21600
```

---

⚠ **This software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
implied. See the License for the specific language governing permissions and limitations under the License.**
