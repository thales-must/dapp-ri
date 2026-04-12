// scripts/gas-calculator.ts
import { createPublicClient, http, formatEther, parseEther } from "viem";
import { sepolia } from "viem/chains";

// ============ 配置 ============
// Chainlink ETH/USD 价格喂价合约地址（Sepolia 测试网）
// 来源: Chainlink 官方文档
const CHAINLINK_ETH_USD_FEED = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
const RPC_URL = process.env.RPC_URL!;

// Chainlink AggregatorV3Interface ABI
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

// ============ 1. 获取 Sepolia 网络 Gas 价格 ============
async function getSepoliaGasPrice(client: any): Promise<bigint> {
  const gasPrice = await client.getGasPrice();
  console.log(`📡 Sepolia Gas Price: ${formatEther(gasPrice)} ETH (${gasPrice} Wei)`);
  console.log(`📡 Gas Price: ~${Number(formatEther(gasPrice)) * 1e9} Gwei`);
  return gasPrice;
}

// ============ 2. 获取 ETH/USD 价格（通过 Chainlink 预言机）============
async function getETHPriceUSD(client: any): Promise<number> {
  try {
    // 调用 Chainlink 合约获取最新价格
    const latestRound = await client.readContract({
      address: CHAINLINK_ETH_USD_FEED as `0x${string}`,
      abi: AGGREGATOR_ABI,
      functionName: "latestRoundData",
    });

    // answer 是 int256 类型，需要转换为 number
    const price = (latestRound as any)[1]; // answer 是第二个返回值
    const decimals = await client.readContract({
      address: CHAINLINK_ETH_USD_FEED as `0x${string}`,
      abi: AGGREGATOR_ABI,
      functionName: "decimals",
    });

    // 价格需要除以 10^decimals（通常是 8）
    const priceUSD = Number(price) / Math.pow(10, Number(decimals));
    console.log(`💰 ETH/USD 价格 (Chainlink): $${priceUSD.toFixed(2)}`);
    return priceUSD;
  } catch (error) {
    console.error("❌ 获取 ETH 价格失败:", error);
    console.log("⚠️ 使用默认价格 $3000");
    return 3000;
  }
}

// ============ 3. 计算 Gas 费用 ============
function calculateGasCost(gasUsed: bigint, gasPriceWei: bigint, ethPriceUSD: number) {
  const totalCostWei = gasUsed * gasPriceWei;
  const totalCostEth = formatEther(totalCostWei);
  const totalCostUSD = parseFloat(totalCostEth) * ethPriceUSD;
  const gasPriceGwei = Number(formatEther(gasPriceWei)) * 1e9;

  return {
    gasUsed,
    gasPriceWei,
    gasPriceGwei,
    totalCostWei,
    totalCostEth,
    totalCostUSD,
    ethPriceUSD,
  };
}

// ============ 4. 格式化输出 ============
function printResult(result: ReturnType<typeof calculateGasCost>) {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                    Gas 费用计算结果                        ║");
  console.log("╠════════════════════════════════════════════════════════════╣");
  console.log(`║ 消耗 Gas:        ${result.gasUsed.toLocaleString().padEnd(35)}║`);
  console.log(
    `║ Gas Price:       ${result.gasPriceGwei.toFixed(4)} Gwei${" ".repeat(27 - result.gasPriceGwei.toFixed(4).length)}║`,
  );
  console.log(
    `║ ETH 价格:        $${result.ethPriceUSD.toFixed(2)}${" ".repeat(30 - result.ethPriceUSD.toFixed(2).length)}║`,
  );
  console.log("╠════════════════════════════════════════════════════════════╣");
  console.log(`║ 总费用 (Wei):    ${result.totalCostWei.toLocaleString().padEnd(35)}║`);
  console.log(`║ 总费用 (ETH):    ${result.totalCostEth.padEnd(35)}║`);
  console.log(
    `║ 总费用 (USD):    $${result.totalCostUSD.toFixed(8)}${" ".repeat(27 - result.totalCostUSD.toFixed(8).length)}║`,
  );
  console.log("╚════════════════════════════════════════════════════════════╝\n");
}

// ============ 主函数 ============
async function main() {
  // 获取命令行参数

  const gasUsed = 116996736882286n;
  console.log(`\n🔢 输入的 Gas 数量: ${gasUsed.toLocaleString()} Gas\n`);

  // 创建 viem 客户端（连接到 Sepolia）
  console.log("🔄 正在连接到 Sepolia 网络...");
  const client = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL),
  });

  // 获取当前 Gas 价格
  console.log("📊 正在获取 Gas 价格...");
  const gasPrice = await getSepoliaGasPrice(client);

  // 获取 ETH/USD 价格
  console.log("💵 正在获取 ETH/USD 汇率...");
  const ethPriceUSD = await getETHPriceUSD(client);

  // 计算费用
  const result = calculateGasCost(gasUsed, gasPrice, ethPriceUSD);

  // 输出结果
  printResult(result);

  // 返回结果（方便其他脚本调用）
  return result;
}

// 执行
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 脚本执行失败:", error);
    process.exit(1);
  });
