// Usage: API_KEY=<> npx tsx ts-test/testnet.ts
import {
  PerChainQueryRequest,
  QueryProxyQueryResponse,
  QueryRequest,
  SolanaAccountQueryRequest,
} from "@wormhole-foundation/wormhole-query-sdk";
import axios from "axios";
import "dotenv/config";
import { logQueryResponseInfo } from "./utils";
import { DATA_SLICE_LENGTH, DATA_SLICE_OFFSET } from "./consts";

const SOLANA_NODE_URL = "https://api.devnet.solana.com";

async function getSolanaSlot(comm: string): Promise<bigint> {
  const response = await axios.post(SOLANA_NODE_URL, {
    jsonrpc: "2.0",
    id: 1,
    method: "getSlot",
    params: [{ commitment: comm, transactionDetails: "none" }],
  });

  return response.data.result;
}

(async () => {
  const QUERY_URL = "https://testnet.query.wormhole.com/v1/query";
  const API_KEY = process.env.API_KEY;
  if (!API_KEY) {
    throw new Error("API_KEY is required");
  }

  const currSlot = await getSolanaSlot("finalized");
  const minContextSlot = BigInt(currSlot) + BigInt(2);

  console.log(
    `Performing query against Wormhole testnet, currentSlot: `,
    currSlot,
    ` using minContext Slot: `,
    minContextSlot,
    `\n`
  );

  // devnet stake pool from
  // solana-program-library % ./target/release/spl-stake-pool --url "https://api.devnet.solana.com" list-all
  const accounts = [
    "DBEr3Z4vdR9WH2jv1hY8Xh1KYQWnBGFjUubvLGdRSvZw",
    "SysvarC1ock11111111111111111111111111111111",
  ];

  const query = new QueryRequest(42, [
    new PerChainQueryRequest(
      1,
      new SolanaAccountQueryRequest(
        "finalized",
        accounts,
        minContextSlot,
        BigInt(DATA_SLICE_OFFSET),
        BigInt(DATA_SLICE_LENGTH)
      )
    ),
  ]);
  const serialized = Buffer.from(query.serialize()).toString("hex");
  const before = performance.now();
  const resp = (
    await axios.post<QueryProxyQueryResponse>(
      QUERY_URL,
      { bytes: serialized },
      { headers: { "X-API-Key": API_KEY } }
    )
  ).data;
  const after = performance.now();
  const logResp = logQueryResponseInfo(resp.bytes);
  if (minContextSlot == logResp.slotNumber) {
    console.log("\nReturned slot matches requested slot.");
  } else {
    console.error(
      "\nSlot mismatch: slotNumber: ",
      logResp.slotNumber,
      ", minContextSlot: ",
      minContextSlot
    );
  }
  console.log(`\nQuery completed in ${(after - before).toFixed(2)}ms.`);
})();
