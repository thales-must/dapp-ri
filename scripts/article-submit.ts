import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

import fs from "fs";
import path from "path";
import * as tar from "tar";
import artifact from "../artifacts/contracts/JournalManager.sol/JournalManager.json";
import { FlatDirectory } from "ethstorage-sdk";

// ----------------------------
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const RPC_URL = process.env.RPC_URL!;
const ETHSTORAGE_RPC = process.env.ETHSTORAGE_RPC!;
const JOURNAL_CONTRACT = process.env.JOURNAL_CONTRACT as `0x${string}`;

const rawData = fs.readFileSync(process.env.PAPER_JSON_FILE!, "utf-8");
const paper = JSON.parse(rawData);

const CHUNK_SIZE = 32768;
const now = () => Date.now();

// ----------------------------
function hexToBytes(hex: `0x${string}`): Uint8Array {
  return new Uint8Array(Buffer.from(hex.slice(2), "hex"));
}

function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return ("0x" + Buffer.from(bytes).toString("hex")) as `0x${string}`;
}

function chunkBytes(data: Uint8Array, size: number): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < data.length; i += size) {
    chunks.push(data.slice(i, i + size));
  }
  return chunks;
}

// ----------------------------
// tar.gz 解压
// ----------------------------
async function extractTarGz(file: string) {
  const tmpDir = `./tmp_${paper.id}`;

  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir);

  await tar.x({ file, cwd: tmpDir });

  const results: { path: string; content: Buffer }[] = [];

  function walk(dir: string) {
    for (let f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);

      if (stat.isDirectory()) walk(full);
      else {
        results.push({
          path: path.relative(tmpDir, full),
          content: fs.readFileSync(full),
        });
      }
    }
  }

  walk(tmpDir);
  return results;
}

// ----------------------------
async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);

  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(RPC_URL),
  });

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL),
  });

  // ============================
  // 🔥 初始化 JSON
  // ============================
  const result: any = {};

  // ============================
  // 🔥 预处理（不计时间）
  // ============================

  const dirContract = (await publicClient.readContract({
    address: JOURNAL_CONTRACT,
    abi: artifact.abi,
    functionName: "dirContract",
  })) as `0x${string}`;

  const flatDirectory = await FlatDirectory.create({
    rpc: RPC_URL,
    ethStorageRpc: ETHSTORAGE_RPC,
    privateKey: PRIVATE_KEY,
    address: dirContract,
  });

  const files = await extractTarGz(paper.tar);
  const assets = files.filter((f) => !f.path.endsWith(".tex"));

  const initTime = now();
  const t = () => now() - initTime;

  // ============================
  // 1️⃣ TEX 上传（并行）
  // ============================
  const texBytes = hexToBytes(paper.data);
  const chunks = chunkBytes(texBytes, CHUNK_SIZE);
  const baseNonce = BigInt(
    await publicClient.getTransactionCount({
      address: account.address,
    }),
  );
  result.texUpload = await Promise.all(
    chunks.map(async (chunk, index) => {
      const start = t();

      const txHash = await wallet.sendTransaction({
        to: "0x0000000000000000000000000000000000000000",
        data: bytesToHex(chunk),
        nonce: Number(baseNonce + BigInt(index)),
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      const end = t();

      return {
        index,
        txHash,
        gas: receipt.gasUsed.toString(),
        size: chunk.length,
        start,
        end,
      };
    }),
  );

  result.texUpload.sort((a: any, b: any) => a.index - b.index);
  const texTxIds = result.texUpload.map((r: any) => r.txHash);

  // ============================
  // 2️⃣ Assets 上传（并行）
  // ============================
  result.assetUpload = [];

  await Promise.all(
    assets.map((file) => {
      const start = t();

      return new Promise<void>((resolve) => {
        flatDirectory.upload({
          key: `c${paper.id}/${file.path}`,
          content: file.content,
          type: 2,
          callback: {
            onFinish: (_, __, cost) => {
              const end = t();

              result.assetUpload.push({
                path: file.path,
                size: file.content.length,
                wei: cost.toString(),
                start,
                end,
              });

              resolve();
            },
          },
        });
      });
    }),
  );

  // ============================
  // 3️⃣ submitArticle
  // ============================
  const submitStart = t();

  const submitHash = await wallet.writeContract({
    address: JOURNAL_CONTRACT,
    abi: artifact.abi,
    functionName: "submitArticle",
    args: [paper.title, paper.authors, texTxIds, paper.extraMetadataURI],
  });

  const submitReceipt = await publicClient.waitForTransactionReceipt({
    hash: submitHash,
  });
  const transaction = await publicClient.getTransaction({ hash: submitHash });
  const calldata = transaction.input;
  const calldataSize = (calldata.length - 2) / 2;

  result.submit = {
    size: calldataSize,
    gas: submitReceipt.gasUsed.toString(),
    start: submitStart,
    end: t(),
  };

  // ============================
  // 4️⃣ 读取链上数据
  // ============================
  const readStart = t();

  const articleCount = (await publicClient.readContract({
    address: JOURNAL_CONTRACT,
    abi: artifact.abi,
    functionName: "articleCount",
  })) as bigint;

  const article = (await publicClient.readContract({
    address: JOURNAL_CONTRACT,
    abi: artifact.abi,
    functionName: "getArticle",
    args: [articleCount - 1n],
  })) as any[];

  result.readContract = {
    start: readStart,
    end: t(),
  };

  // ============================
  // 5️⃣ TEX 重建（并行）
  // ============================
  result.reconstructTex = await Promise.all(
    article[2].map(async (txHash: `0x${string}`) => {
      const start = t();

      const tx = await publicClient.getTransaction({ hash: txHash });
      const bytes = hexToBytes(tx.input as `0x${string}`);

      const end = t();

      return {
        txHash,
        size: bytes.length,
        start,
        end,
      };
    }),
  );

  // ============================
  // 6️⃣ Assets 校验（并行）
  // ============================
  result.verifyAssets = await Promise.all(
    assets.map(async (file) => {
      const start = t();

      await flatDirectory.download(`${paper.id}/${file.path}`);

      const end = t();

      return {
        path: file.path,
        start,
        end,
      };
    }),
  );

  // ============================
  // 💾 保存 JSON
  // ============================
  const outFile = `result_${paper.id}.json`;
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));

  console.log(`✅ Result saved to ${outFile}`);
}

main().catch(console.error);
