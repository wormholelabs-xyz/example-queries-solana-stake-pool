// npx tsx .\ts-test\mock.ts

import {
  PerChainQueryRequest,
  QueryProxyMock,
  QueryRequest,
  QueryResponse,
  SolanaAccountQueryRequest,
  SolanaAccountQueryResponse,
} from "@wormhole-foundation/wormhole-query-sdk";
import bs58 from "bs58";

(async () => {
  const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
  const mock = new QueryProxyMock({
    1: SOLANA_RPC,
  });

  // https://solanacompass.com/stake-pools/Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb
  const accounts = [
    "Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb", // Jito SOL Pool
  ];

  const query = new QueryRequest(42, [
    new PerChainQueryRequest(
      1,
      new SolanaAccountQueryRequest(
        "finalized",
        accounts,
        undefined,
        // only query the required two fields
        // https://github.com/solana-labs/solana-program-library/blob/b7dd8fee93815b486fce98d3d43d1d0934980226/stake-pool/program/src/state.rs#L87-L94
        BigInt(258),
        BigInt(16)
      )
    ),
  ]);
  const resp = await mock.mock(query);
  const queryResponse = QueryResponse.from(Buffer.from(resp.bytes, "hex"));
  const solResponse = queryResponse.responses[0]
    .response as SolanaAccountQueryResponse;
  const blockTime = new Date(
    Number(BigInt(solResponse.blockTime) / BigInt(1000))
  ).toISOString();
  const totalActiveStake = Buffer.from(
    solResponse.results[0].data
  ).readBigUInt64LE(0);
  const poolTokenSupply = Buffer.from(
    solResponse.results[0].data
  ).readBigUInt64LE(8);
  const poolTokenValue = Number(totalActiveStake) / Number(poolTokenSupply);
  console.log("account (base58)", accounts[0]);
  console.log(
    "account (hex)   ",
    Buffer.from(bs58.decode(accounts[0])).toString("hex")
  );
  console.log("slotNumber      ", solResponse.slotNumber.toString());
  console.log("blockTime       ", blockTime);
  console.log("blockHash       ", bs58.encode(solResponse.blockHash));
  console.log("owner (base58)  ", bs58.encode(solResponse.results[0].owner));
  console.log(
    "owner (hex)     ",
    Buffer.from(solResponse.results[0].owner).toString("hex")
  );
  console.log(
    "data            ",
    Buffer.from(solResponse.results[0].data).toString("hex")
  );
  console.log("totalActiveStake", totalActiveStake.toString());
  console.log("poolTokenSupply ", poolTokenSupply.toString());
  console.log("poolTokenValue  ", poolTokenValue);
})();
