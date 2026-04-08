import fs from "fs";
import path from "path";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain, encodeFunctionData } from "viem";
import { stringify } from "csv-stringify/sync";

// ====== 配置 ======
const DATA_DIR = "D:/thales/must/destorage/src/files/hexs";
const OUTPUT_CSV = "./benchmark.csv";
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// 建议从 1024 开始
const CHUNK_SIZES = [1024, 2048, 4096, 8192, 16384];

// 控制参数
const RETRY_LIMIT = 3;
const FAIL_RATE = 0.05; // 模拟失败（可设为 0 关闭）

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

// ====== ABI ======
const abi = [
  {
    name: "submit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "data", type: "bytes" }],
    outputs: [],
  },
];

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
function chunkHex(hex: string, chunkSize: number): string[] {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const chunks: string[] = [];
  const step = chunkSize * 2;

  for (let i = 0; i < clean.length; i += step) {
    chunks.push("0x" + clean.slice(i, i + step));
  }

  return chunks;
}

// ====== send（带 retry + fail 注入） ======
async function sendChunk(chunk: string) {
  let attempts = 0;

  while (attempts < RETRY_LIMIT) {
    try {
      if (Math.random() < FAIL_RATE) {
        throw new Error("Simulated failure");
      }

      const start = Date.now();

      const data = encodeFunctionData({
        abi,
        functionName: "submit",
        args: [chunk],
      });

      const hash = await walletClient.sendTransaction({
        to: CONTRACT_ADDRESS,
        data,
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
      });

      const end = Date.now();

      return {
        success: true,
        gas: Number(receipt.gasUsed),
        time: end - start,
        attempts,
      };
    } catch (e) {
      attempts++;
    }
  }

  return {
    success: false,
    gas: 0,
    time: 0,
    attempts: RETRY_LIMIT,
  };
}

// ====== 主流程 ======
async function main() {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));

  const results: any[] = [];

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const json = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    const hex = json.data;
    const id = json.id;

    console.log(`\n📄 Processing ${id}`);

    for (const chunkSize of CHUNK_SIZES) {
      const chunks = chunkHex(hex, chunkSize);

      let totalGas = 0;
      let totalTime = 0;
      let failureCount = 0;
      let retryCount = 0;

      const startUpload = Date.now();

      for (let i = 0; i < chunks.length; i++) {
        const res = await sendChunk(chunks[i]);

        if (!res.success) {
          failureCount++;
        }

        retryCount += res.attempts;

        totalGas += res.gas;
        totalTime += res.time;

        process.stdout.write(
          `  size=${chunkSize} chunk=${i + 1}/${chunks.length} gas=${res.gas}\r`,
        );
      }

      const endUpload = Date.now();

      const avgGas = chunks.length > 0 ? totalGas / chunks.length : 0;

      const avgTime = chunks.length > 0 ? totalTime / chunks.length : 0;

      const gasPerKB = totalGas / (hex.length / 2 / 1024);

      console.log(`\n✅ ${id} | size=${chunkSize} gas=${totalGas} time=${endUpload - startUpload}`);

      results.push({
        id,
        chunk_size: chunkSize,
        chunk_count: chunks.length,

        total_gas: totalGas,
        avg_gas_per_chunk: avgGas.toFixed(2),
        gas_per_kb: gasPerKB.toFixed(2),

        upload_time_ms: endUpload - startUpload,
        avg_tx_time_ms: avgTime.toFixed(2),

        retry_count: retryCount,
        failure_count: failureCount,
      });
    }
  }

  // ====== CSV ======
  const csv = stringify(results, { header: true });
  fs.writeFileSync(OUTPUT_CSV, csv);

  console.log("\n🎉 Done! CSV saved:", OUTPUT_CSV);
}

main().catch(console.error);
