import {
  PerChainQueryRequest,
  QueryProxyMock,
  QueryRequest,
  SolanaAccountQueryRequest,
} from "@wormhole-foundation/wormhole-query-sdk";
import { Wallet, getDefaultProvider } from "ethers";
import { StakePoolRate__factory } from "../types/ethers-contracts";
import { logQueryResponseInfo } from "./utils";

(async () => {
  const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
  const ETH_NETWORK = "http://localhost:8545";
  const ANVIL_FORK_KEY =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const WORMHOLE_ADDRESS = "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B";
  const JITO_ADDRESS_HEX = // Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb
    "0x048a3e08c3b495be17f45427d89bec5b80c7e2695c1864d76743db39bed346d6";
  const STAKE_POOL_OWNER_HEX = // SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy
    "0x06814ed4caf68a174672fdac86031a63e84ea15efa1d44b72293f6dbdb001650";
  const ALLOWED_STALENESS = 21600;

  console.log(`Mocking query using ${SOLANA_RPC}\n`);

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
  logQueryResponseInfo(resp.bytes);

  console.log(
    `\nDeploying StakePoolRate ${WORMHOLE_ADDRESS} ${JITO_ADDRESS_HEX} ${STAKE_POOL_OWNER_HEX} ${ALLOWED_STALENESS}\n`
  );
  const provider = getDefaultProvider(ETH_NETWORK);
  const signer = new Wallet(ANVIL_FORK_KEY, provider);
  const stakePoolRateFactory = new StakePoolRate__factory(signer);
  const stakePoolRate = await stakePoolRateFactory.deploy(
    WORMHOLE_ADDRESS,
    JITO_ADDRESS_HEX,
    STAKE_POOL_OWNER_HEX,
    ALLOWED_STALENESS
  );
  console.log(`Deployed address ${await stakePoolRate.getAddress()}`);

  console.log(`\nPosting query\n`);
  const tx = await stakePoolRate.updatePool(
    `0x${resp.bytes}`,
    resp.signatures.map((s) => ({
      r: `0x${s.substring(0, 64)}`,
      s: `0x${s.substring(64, 128)}`,
      v: `0x${(parseInt(s.substring(128, 130), 16) + 27).toString(16)}`,
      guardianIndex: `0x${s.substring(130, 132)}`,
    }))
  );
  const receipt = await tx.wait();
  console.log("Updated            ", receipt?.hash);

  const [totalActiveStakeEth, poolTokenSupplyEth] =
    await stakePoolRate.getRate();
  const poolTokenValueEth =
    Number(totalActiveStakeEth) / Number(poolTokenSupplyEth);
  console.log(
    "solana slot number ",
    (await stakePoolRate.lastUpdateSolanaSlotNumber()).toString()
  );
  console.log(
    "solana block time  ",
    new Date(
      Number((await stakePoolRate.lastUpdateSolanaBlockTime()) / BigInt(1000))
    ).toISOString()
  );
  console.log("totalActiveStakeEth", totalActiveStakeEth.toString());
  console.log("poolTokenSupplyEth ", poolTokenSupplyEth.toString());
  console.log("poolTokenValueEth  ", poolTokenValueEth);
})();
