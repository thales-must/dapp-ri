import fs from "fs";
import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { stringify } from "csv-stringify/sync";

// ====== 配置 ======
const PAPER_JSON_FILE = "opt/2603.25100v1.json";
const OUTPUT_CSV = "./analysis/files/chunk-gas-latency.csv";

const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// ====== chain ======
const hardhat = defineChain({
  id: 31337,
  name: "Hardhat",
  network: "hardhat",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
});

// ====== client ======
const account = privateKeyToAccount(PRIVATE_KEY);

const walletClient = createWalletClient({
  account,
  chain: hardhat,
  transport: http(),
});

const publicClient = createPublicClient({
  chain: hardhat,
  transport: http(),
});

// ====== chunk ======
function chunkHex(hex: string, chunkSize: number): `0x${string}`[] {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const step = chunkSize * 2;

  const chunks: `0x${string}`[] = [];
  for (let i = 0; i < clean.length; i += step) {
    chunks.push(`0x${clean.slice(i, i + step)}`);
  }

  return chunks;
}

// ====== send（正确模型） ======
async function sendChunk(chunk: `0x${string}`) {
  const start = Date.now();

  const hash = await walletClient.sendTransaction({
    to: "0x0000000000000000000000000000000000000000",
    data: chunk,
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
  });

  const end = Date.now();

  const totalGasUsed = receipt.gasUsed;
  const totalTime = end - start;

  return {
    totalGasUsed,
    totalTime,
  };
}

// ====== 主流程 ======
async function main() {
  const rawData = fs.readFileSync(PAPER_JSON_FILE, "utf-8");
  const paper = JSON.parse(rawData);
  const hex = paper.data;
  const results = [];
  for (let n = 10; n <= 18; n++) {
    const chunkSize = 2 ** n;
    const gasArr: bigint[] = [];
    const timeArr: number[] = [];
    const chunks = chunkHex(hex, chunkSize);

    for (let n = 0; n < 50; n++) {
      for (let i = 0; i < chunks.length; i++) {
        const res = await sendChunk(chunks[i]);
        gasArr.push(res.totalGasUsed);
        timeArr.push(res.totalTime);
      }
      const totalGas = gasArr.reduce((sum, val) => sum + val, 0n);
      const seriesTime = timeArr.reduce((sum, val) => sum + val, 0);
      const parallelTime = timeArr.reduce((max, val) => Math.max(max, val), 0);

      results.push({
        chunkSize,
        chunks: chunks.length,
        n,
        totalGas,
        seriesTime,
        parallelTime,
      });
    }
  }

  const csv = stringify(results, { header: true });
  fs.writeFileSync(OUTPUT_CSV, csv);

  console.log("\n🎉 Done! CSV saved:", OUTPUT_CSV);
}

main().catch(console.error);
