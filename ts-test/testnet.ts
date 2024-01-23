import {
  PerChainQueryRequest,
  QueryProxyQueryResponse,
  QueryRequest,
  SolanaAccountQueryRequest,
} from "@wormhole-foundation/wormhole-query-sdk";
import axios from "axios";
import "dotenv/config";
import { logQueryResponseInfo } from "./utils";

(async () => {
  const QUERY_URL = "https://testnet.ccq.vaa.dev/v1/query";
  const API_KEY = process.env.API_KEY;
  if (!API_KEY) {
    throw new Error("API_KEY is required");
  }

  console.log(`Performing query against Wormhole testnet\n`);

  // devnet stake pool from
  // solana-program-library % ./target/release/spl-stake-pool --url "https://api.devnet.solana.com" list-all
  const accounts = ["DBEr3Z4vdR9WH2jv1hY8Xh1KYQWnBGFjUubvLGdRSvZw"];

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
  logQueryResponseInfo(resp.bytes);
  console.log(`\nQuery completed in ${(after - before).toFixed(2)}ms.`);
})();
