// scripts/network-info.ts
import { createPublicClient, http, formatEther } from "viem";
import { sepolia, mainnet } from "viem/chains";

// ========= 直接写死 RPC =========
// ⚠️ 可以换成你自己的（Alchemy / Infura / 公共RPC）
const MAINNET_RPC = "https://ethereum.publicnode.com";
const SEPOLIA_RPC = "https://ethereum-sepolia.publicnode.com";

// ========= Chainlink 主网 ETH/USD =========
const CHAINLINK_ETH_USD = "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419";

// ========= ABI =========
const AGGREGATOR_ABI = [
  {
    inputs: [],
    name: "latestRoundData",
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ========= 工具 =========
function weiToGwei(wei: bigint): number {
  return Number(formatEther(wei)) * 1e9;
}

// ========= 主函数 =========
async function main() {
  console.log("🔄 Fetching network info...\n");

  const sepoliaClient = createPublicClient({
    chain: sepolia,
    transport: http(SEPOLIA_RPC),
  });

  const mainnetClient = createPublicClient({
    chain: mainnet,
    transport: http(MAINNET_RPC),
  });

  // 并发获取 gas
  const [sepoliaGas, mainnetGas] = await Promise.all([
    sepoliaClient.getGasPrice(),
    mainnetClient.getGasPrice(),
  ]);

  // 获取 ETH/USD
  const latest = await mainnetClient.readContract({
    address: CHAINLINK_ETH_USD as `0x${string}`,
    abi: AGGREGATOR_ABI,
    functionName: "latestRoundData",
  });

  const decimals = await mainnetClient.readContract({
    address: CHAINLINK_ETH_USD as `0x${string}`,
    abi: AGGREGATOR_ABI,
    functionName: "decimals",
  });

  const ethUsd = Number((latest as any)[1]) / Math.pow(10, Number(decimals));

  // ========= 输出 =========
  console.log("📊 Gas Price:");
  console.log(`Sepolia: ${weiToGwei(sepoliaGas).toFixed(2)} Gwei`);
  console.log(`Mainnet: ${weiToGwei(mainnetGas).toFixed(2)} Gwei`);

  console.log("\n💰 ETH/USD:");
  console.log(`$${ethUsd.toFixed(2)}`);

  const result = {
    gas: {
      sepolia: {
        gwei: weiToGwei(sepoliaGas),
      },
      mainnet: {
        gwei: weiToGwei(mainnetGas),
      },
    },
    ethUsd,
  };

  console.log("\n📦 JSON:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
