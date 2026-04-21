import fs from "fs";
import path from "path";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import { stringify } from "csv-stringify/sync";

// ====== 配置 ======
const DATA_DIR = "./analysis/files/hexs";
const OUTPUT_CSV = "./analysis/files/chunk-sample.csv";

const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const CHUNK_SIZE = 32768;

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
    to: account.address,
    data: chunk,
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
  });

  const end = Date.now();

  return {
    totalGasUsed: receipt.gasUsed,
    totalTime: end - start,
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

    const totalBytes = hex.length / 2;

    const chunks = chunkHex(hex, CHUNK_SIZE);

    let totalGas = 0n;
    let totalTime = 0;

    const startUpload = Date.now();

    for (let i = 0; i < chunks.length; i++) {
      const res = await sendChunk(chunks[i]);

      totalGas += res.totalGasUsed;
      if (totalTime < res.totalTime) {
        totalTime = res.totalTime;
      }
    }

    const endUpload = Date.now();

    // ====== 指标 ======
    const idealTxCount = chunks.length;

    const gasPerKB = Number(totalGas) / (totalBytes / 1024);

    const avgGasPerChunk = idealTxCount > 0 ? Number(totalGas) / idealTxCount : 0;

    const avgTimePerChunk = idealTxCount > 0 ? totalTime / idealTxCount : 0;

    console.log(`\n✅ ${id} | gas=${totalGas}`);

    results.push({
      id,
      chunk_count: idealTxCount,
      total_bytes: totalBytes,

      // ===== gas =====
      total_gas: totalGas.toString(),
      gas_per_kb: gasPerKB.toFixed(2),
      avg_gas_per_chunk: avgGasPerChunk.toFixed(2),

      // ===== time =====
      upload_time_ms: endUpload - startUpload,
      avg_tx_time_ms: avgTimePerChunk.toFixed(2),
    });
  }

  const csv = stringify(results, { header: true });
  fs.writeFileSync(OUTPUT_CSV, csv);

  console.log("\n🎉 Done! CSV saved:", OUTPUT_CSV);
}

main().catch(console.error);
