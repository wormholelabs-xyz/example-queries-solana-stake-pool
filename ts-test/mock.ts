import {
  PerChainQueryRequest,
  QueryProxyMock,
  QueryRequest,
  SolanaAccountQueryRequest,
  signaturesToEvmStruct,
} from "@wormhole-foundation/wormhole-query-sdk";
import { strictEqual } from "assert";
import base58 from "bs58";
import { Wallet, getDefaultProvider } from "ethers";
import { StakePoolRate__factory } from "../types/ethers-contracts";
import { DATA_SLICE_LENGTH, DATA_SLICE_OFFSET } from "./consts";
import { logQueryResponseInfo } from "./utils";

(async () => {
  const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
  const ETH_NETWORK = "http://localhost:8545";
  const ANVIL_FORK_KEY =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const WORMHOLE_ADDRESS = "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B";
  const JITO_SOL_POOL = "Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb"; // https://solanacompass.com/stake-pools/Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbbs
  const SYSVAR_CLOCK = "SysvarC1ock11111111111111111111111111111111";
  const JITO_ADDRESS_HEX = `0x${Buffer.from(
    base58.decode(JITO_SOL_POOL)
  ).toString("hex")}`;
  const THIRTY_MINUTES = 60 * 30;
  const THIRTY_DAYS = 60 * 60 * 24 * 30;

  console.log(`Mocking query using ${SOLANA_RPC}\n`);

  const mock = new QueryProxyMock({
    1: SOLANA_RPC,
  });

  const accounts = [JITO_SOL_POOL, SYSVAR_CLOCK];

  const query = new QueryRequest(42, [
    new PerChainQueryRequest(
      1,
      new SolanaAccountQueryRequest(
        "finalized",
        accounts,
        undefined,
        BigInt(DATA_SLICE_OFFSET),
        BigInt(DATA_SLICE_LENGTH)
      )
    ),
  ]);
  const resp = await mock.mock(query);
  const { slotNumber, blockTime, totalActiveStake, poolTokenSupply } =
    logQueryResponseInfo(resp.bytes);

  console.log(
    `\nDeploying StakePoolRate ${WORMHOLE_ADDRESS} ${JITO_ADDRESS_HEX} ${THIRTY_MINUTES} ${THIRTY_DAYS}\n`
  );
  const provider = getDefaultProvider(ETH_NETWORK);
  const signer = new Wallet(ANVIL_FORK_KEY, provider);
  const stakePoolRateFactory = new StakePoolRate__factory(signer);
  const stakePoolRate = await stakePoolRateFactory.deploy(
    WORMHOLE_ADDRESS,
    JITO_ADDRESS_HEX,
    THIRTY_MINUTES,
    THIRTY_DAYS
  );
  await stakePoolRate.waitForDeployment();
  console.log(`Deployed address ${await stakePoolRate.getAddress()}`);

  console.log(`\nPosting query\n`);
  const tx = await stakePoolRate.updatePool(
    `0x${resp.bytes}`,
    signaturesToEvmStruct(resp.signatures)
  );
  const receipt = await tx.wait();
  console.log("Updated            ", receipt?.hash);

  const solanaSlotNumberEth = await stakePoolRate.lastUpdateSolanaSlotNumber();
  const solanaBlockTimeEth = await stakePoolRate.lastUpdateSolanaBlockTime();
  const totalActiveStakeEth = await stakePoolRate.totalActiveStake();
  const poolTokenSupplyEth = await stakePoolRate.poolTokenSupply();
  const poolTokenValueEth = await stakePoolRate.getRate();
  const poolTokenValueAdj = Number(poolTokenValueEth) / 10 ** 18;
  console.log("solana slot number ", solanaSlotNumberEth.toString());
  console.log(
    "solana block time  ",
    new Date(Number(solanaBlockTimeEth / BigInt(1000))).toISOString()
  );
  console.log("totalActiveStakeEth", totalActiveStakeEth.toString());
  console.log("poolTokenSupplyEth ", poolTokenSupplyEth.toString());
  console.log("poolTokenValueEth  ", poolTokenValueEth.toString());
  console.log("Value adjusted     ", poolTokenValueAdj);

  strictEqual(solanaSlotNumberEth, slotNumber);
  strictEqual(solanaBlockTimeEth, blockTime);
  strictEqual(totalActiveStakeEth, totalActiveStake);
  strictEqual(poolTokenSupplyEth, poolTokenSupply);
  strictEqual(
    poolTokenValueEth,
    (totalActiveStake * BigInt(10) ** BigInt(18)) / poolTokenSupply
  );

  provider.destroy();
})();
