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

const rawData = fs.readFileSync(process.env.PAPER_JSON_FILE, "utf-8");
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
function getArticle(values: string[]): Object {
  const keys = [
    "title",
    "authors",
    "keywords",
    "texTxIds",
    "dirContract",
    "encryptedKey",
    "extraMetadataURI",
  ];
  return keys.reduce(
    (acc, key, index) => {
      acc[key] = values[index];
      return acc;
    },
    {} as Record<string, string | number>,
  );
}

// ----------------------------
// tar.gz 解压（保留路径）
// ----------------------------
async function extractTarGz(file: string) {
  const tmpDir = "./tmp_assets";

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
  // 1️⃣ TEX → calldata（逐 chunk）
  // ============================
  const texBytes = hexToBytes(paper.data);
  const chunks = chunkBytes(texBytes, CHUNK_SIZE);

  const texTxIds: `0x${string}`[] = [];
  const texStats: any[] = [];

  const t_tex_upload_start = now();

  for (let chunk of chunks) {
    const start = now();

    const txHash = await wallet.sendTransaction({
      to: "0x0000000000000000000000000000000000000000",
      data: bytesToHex(chunk),
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    const end = now();

    texTxIds.push(txHash);

    texStats.push({
      size: chunk.length,
      gas: receipt.gasUsed.toString(),
      time: end - start,
    });
  }

  const t_tex_upload_end = now();

  // ============================
  // 2️⃣ EthStorage deploy
  // ============================
  const flatDirectory = await FlatDirectory.create({
    rpc: RPC_URL,
    ethStorageRpc: ETHSTORAGE_RPC,
    privateKey: PRIVATE_KEY,
  });

  const deployStart = await publicClient.getBlockNumber();
  const dirContract = await flatDirectory.deploy();
  const deployEnd = await publicClient.getBlockNumber();

  let deployGas = 0n;

  for (let i = deployStart; i <= deployEnd; i++) {
    const block = await publicClient.getBlock({
      blockNumber: i,
      includeTransactions: true,
    });

    for (const tx of block.transactions) {
      if (
        typeof tx !== "string" &&
        tx.from?.toLowerCase() === account.address.toLowerCase() &&
        tx.to === null
      ) {
        const receipt = await publicClient.getTransactionReceipt({
          hash: tx.hash,
        });
        deployGas = receipt.gasUsed;
      }
    }
  }

  // ============================
  // 3️⃣ Assets upload
  // ============================
  const files = await extractTarGz(paper.tar);
  const assets = files.filter((f) => !f.path.endsWith(".tex"));

  const assetStats: any[] = [];

  const t_assets_upload_start = now();

  for (let file of assets) {
    const start = now();
    let gas = 0;

    await flatDirectory.upload({
      key: file.path,
      content: file.content,
      type: 2,
      callback: {
        onFinish: (_, __, cost) => {
          gas = cost;
        },
      },
    });

    const end = now();

    assetStats.push({
      path: file.path,
      size: file.content.length,
      gas,
      time: end - start,
    });
  }

  const t_assets_upload_end = now();

  // ============================
  // 4️⃣ submitArticle
  // ============================
  const t_submit_start = now();

  const encryptedKey = paper.key.startsWith("0x") ? paper.key : `0x${paper.key}`;
  const submitHash = await wallet.writeContract({
    address: JOURNAL_CONTRACT,
    abi: artifact.abi,
    functionName: "submitArticle",
    args: [
      paper.title,
      paper.authors,
      paper.keywords,
      texTxIds,
      dirContract,
      encryptedKey,
      paper.extraMetadataURI,
    ],
  });

  const submitReceipt = await publicClient.waitForTransactionReceipt({
    hash: submitHash,
  });

  const t_submit_end = now();

  // ============================
  // 5️⃣ 从合约读取 TEX（关键）
  // ============================
  const t_read_contract_start = now();

  const articleCount = await publicClient.readContract({
    address: JOURNAL_CONTRACT,
    abi: artifact.abi,
    functionName: "articleCount",
    args: [],
  });

  const articleArray = await publicClient.readContract({
    address: JOURNAL_CONTRACT,
    abi: artifact.abi,
    functionName: "getArticle",
    args: [articleCount - 1n],
  });
  const article = getArticle(articleArray);

  const texTxIdsFromChain = article.texTxIds;

  const t_read_contract_end = now();

  // ============================
  // 6️⃣ TEX 重建（链上）
  // ============================
  const t_reconstruct_start = now();

  let reconstructed: number[] = [];

  for (let txHash of texTxIdsFromChain) {
    const tx = await publicClient.getTransaction({ hash: txHash });
    const bytes = hexToBytes(tx.input as `0x${string}`);
    reconstructed.push(...bytes);
  }

  const t_reconstruct_end = now();

  // 校验 TEX
  const originalTex = hexToBytes(paper.data);

  if (reconstructed.length !== originalTex.length) {
    throw new Error("TEX length mismatch");
  }

  for (let i = 0; i < originalTex.length; i++) {
    if (reconstructed[i] !== originalTex[i]) {
      throw new Error("TEX mismatch");
    }
  }

  // ============================
  // 7️⃣ Assets 校验
  // ============================
  const t_assets_verify_start = now();

  for (let file of assets) {
    const data = await flatDirectory.download(file.path);

    // if (data.length !== file.content.length) {
    //   throw new Error(`Asset size mismatch: ${file.path}`);
    // }

    // for (let i = 0; i < data.length; i++) {
    //   if (data[i] !== file.content[i]) {
    //     throw new Error(`Asset mismatch: ${file.path}`);
    //   }
    // }
  }

  const t_assets_verify_end = now();

  // ============================
  // RESULT
  // ============================
  console.log({
    timing: {
      texUpload: t_tex_upload_end - t_tex_upload_start,
      assetsUpload: t_assets_upload_end - t_assets_upload_start,
      submit: t_submit_end - t_submit_start,
      readContract: t_read_contract_end - t_read_contract_start,
      reconstructTex: t_reconstruct_end - t_reconstruct_start,
      verifyAssets: t_assets_verify_end - t_assets_verify_start,
    },
    gas: {
      submitGas: submitReceipt.gasUsed.toString(),
      deployGas: deployGas.toString(),
    },
    tex: texStats,
    assets: assetStats,
  });
}

main().catch(console.error);
