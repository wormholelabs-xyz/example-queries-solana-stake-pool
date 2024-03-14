import {
  PerChainQueryRequest,
  QueryProxyMock,
  QueryRequest,
  SolanaAccountQueryRequest,
  signaturesToEvmStruct,
} from "@wormhole-foundation/wormhole-query-sdk";
import base58 from "bs58";
import { DATA_SLICE_LENGTH, DATA_SLICE_OFFSET } from "./consts";
import { logQueryResponseInfo } from "./utils";

(async () => {
  const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
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
  const {
    slotNumber,
    blockTime,
    totalActiveStake,
    poolTokenSupply,
    clockEpoch,
  } = logQueryResponseInfo(resp.bytes);
  const sig = signaturesToEvmStruct(resp.signatures);
  console.log("\n\n*****\nmock result for Solidity\n*****\n\n");
  console.log(`    // some happy case defaults`);
  console.log(`    bytes mockMainnetResponse = hex"${resp.bytes}";`);
  console.log(`    uint8 mockMainnetSigV = 0x${sig[0].v};`);
  console.log(`    bytes32 mockMainnetSigR = 0x${sig[0].r};`);
  console.log(`    bytes32 mockMainnetSigS = 0x${sig[0].s};`);
  console.log(`    uint64 mockSlot = ${slotNumber.toString()};`);
  console.log(`    uint64 mockBlockTime = ${blockTime.toString()};`);
  console.log(`    uint64 mockEpoch = ${clockEpoch.toString()};`);
  console.log(
    `    uint64 mockTotalActiveStake = ${totalActiveStake.toString()};`
  );
  console.log(
    `    uint64 mockPoolTokenSupply = ${poolTokenSupply.toString()};`
  );
  console.log(
    `    uint256 mockRate = ${
      (totalActiveStake * BigInt(10) ** BigInt(18)) / poolTokenSupply
    }; // (mockTotalActiveStake * (10 ** 18)) / mockPoolTokenSupply\n`
  );
})();
