import {
  QueryResponse,
  SolanaAccountQueryRequest,
  SolanaAccountQueryResponse,
} from "@wormhole-foundation/wormhole-query-sdk";
import bs58 from "bs58";

export function logQueryResponseInfo(bytes: string) {
  const queryResponse = QueryResponse.from(Buffer.from(bytes, "hex"));
  const solRequest = queryResponse.request.requests[0]
    .query as SolanaAccountQueryRequest;
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
  console.log("account (base58)", bs58.encode(solRequest.accounts[0]));
  console.log(
    "account (hex)   ",
    Buffer.from(solRequest.accounts[0]).toString("hex")
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
}
