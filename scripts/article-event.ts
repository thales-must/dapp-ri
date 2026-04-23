import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import type { PrivateKeyAccount } from "viem/accounts";
import type { WalletClient, PublicClient } from "viem";

import { stringify } from "csv-stringify/sync";
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
const FLAT_KEY = process.env.FLAT_KEY as `0x${string}`;
const CHUNK_SIZE = 32768;

interface IConfig {
  PRIVATE_KEY: `0x${string}`;
  RPC_URL: string;
  ETHSTORAGE_RPC: string;
  JOURNAL_CONTRACT: `0x${string}`;
  FLAT_KEY: `0x${string}`;
  CHUNK_SIZE: number;
  paperJsonFile: string;
}
interface IPaper {
  id: string;
  title: string;
  authors: string[];
  tar: string;
  extraMetadataURI: string;
  key: string;
  data: string;
}
interface IEvent {
  run: number;

  stage: string; // tex_upload / asset_upload / submit / ...
  type: string; // chunk / file / tx / contract

  id: string; // chunk_0 / fig1.png / txHash

  size?: number; // bytes
  chunks?: number; // asset chunk count
  gas?: number; // gasUsed
  wei?: number; // asset cost

  start: number;
  end: number;
}

const param = {
  PRIVATE_KEY,
  RPC_URL,
  ETHSTORAGE_RPC,
  JOURNAL_CONTRACT,
  FLAT_KEY,
  CHUNK_SIZE,
};

class PipelineRunner {
  config: IConfig;
  results: any;
  account: PrivateKeyAccount;
  wallet: WalletClient;
  publicClient: PublicClient;
  files: any = [];
  assets: any = [];
  chunks: any = [];
  texBytes: Uint8Array = new Uint8Array();
  paper: IPaper;
  flatDirectory?: FlatDirectory;
  events: IEvent[] = [];
  constructor(config: IConfig) {
    this.config = config;
    this.results = [];

    const rawData = fs.readFileSync(config.paperJsonFile, "utf-8");
    this.paper = JSON.parse(rawData) as IPaper;

    this.account = privateKeyToAccount(config.PRIVATE_KEY);
    this.wallet = createWalletClient({
      account: this.account,
      chain: sepolia,
      transport: http(config.RPC_URL),
    });
    this.publicClient = createPublicClient({
      chain: sepolia,
      transport: http(config.RPC_URL),
    });
  }

  async init() {
    // 🔥 解压 + 预处理（只做一次）
    this.files = await this.extractTarGz(`analysis/${this.paper.tar}`);
    this.assets = this.files.filter((f: any) => !f.path.endsWith(".tex"));

    this.texBytes = this.hexToBytes(this.paper.data as `0x${string}`);
    this.chunks = this.chunkBytes(this.texBytes, this.config.CHUNK_SIZE);
    const dirContract = (await this.publicClient.readContract({
      address: JOURNAL_CONTRACT,
      abi: artifact.abi,
      functionName: "dirContract",
    })) as `0x${string}`;

    this.flatDirectory = await FlatDirectory.create({
      rpc: this.config.RPC_URL,
      ethStorageRpc: this.config.ETHSTORAGE_RPC,
      privateKey: this.config.FLAT_KEY,
      address: dirContract,
    });
  }
  hexToBytes(hex: `0x${string}`): Uint8Array {
    return new Uint8Array(Buffer.from(hex.slice(2), "hex"));
  }

  bytesToHex(bytes: Uint8Array): `0x${string}` {
    return ("0x" + Buffer.from(bytes).toString("hex")) as `0x${string}`;
  }

  chunkBytes(data: Uint8Array, size: number): Uint8Array[] {
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < data.length; i += size) {
      chunks.push(data.slice(i, i + size));
    }
    return chunks;
  }
  async extractTarGz(file: string) {
    const tmpDir = `./tmp_${this.paper.id}`;

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
  async runOnce(runId: number) {
    const baseNonce = await this.publicClient.getTransactionCount({
      address: this.account.address,
      blockTag: "pending",
    });

    const t0 = Date.now();
    const now = () => Date.now() - t0;

    const events: any[] = [];

    // =========================
    // 1️⃣ ASSETS 上传（并行 + 单独记录）
    // =========================
    const assetPromise = Promise.all(
      this.assets.map(
        (file: any, idx: number) =>
          new Promise<void>((resolve) => {
            const start = now();

            this.flatDirectory?.upload({
              key: `${this.paper.id}/${runId}/${file.path}`,
              content: file.content,
              type: 2,
              callback: {
                onFinish: (chunks, size, cost) => {
                  const end = now();

                  events.push({
                    run: runId,
                    stage: "asset_upload",
                    type: "file",
                    id: file.path,

                    size,
                    chunks,
                    wei: Number(cost),

                    start,
                    end,
                  });

                  resolve();
                },
              },
            });
          }),
      ),
    );

    // =========================
    // 2️⃣ TEX 上传（并行 + 单 chunk）
    // =========================
    const txHashes = await Promise.all(
      this.chunks.map(async (chunk: any, i: number) => {
        const start = now();

        const txHash = await this.wallet.sendTransaction({
          to: "0x0000000000000000000000000000000000000000",
          data: this.bytesToHex(chunk),
          nonce: baseNonce + i,
        });

        const receipt = await this.publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        const end = now();

        events.push({
          run: runId,
          stage: "tex_upload",
          type: "chunk",
          id: `chunk_${i}`,

          size: chunk.length,
          gas: Number(receipt.gasUsed),

          start,
          end,
        });

        return txHash;
      }),
    );

    // =========================
    // 3️⃣ submit（串行）
    // =========================
    const submitStart = now();

    const submitHash = await this.wallet.writeContract({
      address: this.config.JOURNAL_CONTRACT,
      abi: artifact.abi,
      functionName: "submitArticle",
      args: [
        `${this.paper.id}-${runId}`,
        this.paper.title,
        this.paper.authors,
        txHashes,
        this.paper.extraMetadataURI,
      ],
    });

    const submitReceipt = await this.publicClient.waitForTransactionReceipt({
      hash: submitHash,
    });
    const transaction = await this.publicClient.getTransaction({ hash: submitHash });
    const calldata = transaction.input;
    const calldataSize = (calldata.length - 2) / 2;

    const submitEnd = now();

    events.push({
      run: runId,
      stage: "submit",
      type: "contract",
      id: submitHash,

      gas: Number(submitReceipt.gasUsed),
      size: calldataSize,

      start: submitStart,
      end: submitEnd,
    });

    // =========================
    // 4️⃣ 等待 assets 完成
    // =========================
    await assetPromise;

    // =========================
    // 5️⃣ read contract
    // =========================
    const readStart = now();

    const articleCount = (await this.publicClient.readContract({
      address: this.config.JOURNAL_CONTRACT,
      abi: artifact.abi,
      functionName: "articleCount",
    })) as bigint;

    const article: any = await this.publicClient.readContract({
      address: this.config.JOURNAL_CONTRACT,
      abi: artifact.abi,
      functionName: "getArticle",
      args: [articleCount - 1n],
    });

    const readEnd = now();

    events.push({
      run: runId,
      stage: "read_contract",
      type: "contract",
      id: `article_${articleCount - 1n}`,

      start: readStart,
      end: readEnd,
    });

    // =========================
    // 6️⃣ TEX 重建（并行）
    // =========================
    await Promise.all(
      article[3].map(async (txHash: `0x${string}`, i: number) => {
        const start = now();

        const tx = await this.publicClient.getTransaction({ hash: txHash });
        const bytes = this.hexToBytes(tx.input as `0x${string}`);

        const end = now();

        events.push({
          run: runId,
          stage: "reconstruct_tex",
          type: "chunk",
          id: `chunk_${i}`,

          size: bytes.length,

          start,
          end,
        });
      }),
    );

    // =========================
    // 7️⃣ assets 下载（并行）
    // =========================
    await Promise.all(
      this.assets.map(async (file: any) => {
        const start = now();

        await this.flatDirectory?.download(`${this.paper.id}/${runId}/${file.path}`);

        const end = now();

        events.push({
          run: runId,
          stage: "asset_download",
          type: "file",
          id: file.path,

          start,
          end,
        });
      }),
    );

    // =========================
    // 🔥 排序（非常关键！）
    // =========================
    // events.sort((a, b) => a.start - b.start);

    // =========================
    // 🔥 存储
    // =========================
    this.events.push(...events);
  }
  saveCSV(file: string) {
    const columns = ["run", "stage", "type", "id", "size", "chunks", "gas", "wei", "start", "end"];
    const csv = stringify(this.events, {
      header: true,
      columns,
    });

    fs.writeFileSync(file, csv);
  }
  async batch(file: string) {
    await this.init();
    for (let n = 0; n < 20; n++) {
      await this.runOnce(n + 1010);
    }
    this.saveCSV(file);
  }
}

const maxRunner = new PipelineRunner({
  PRIVATE_KEY,
  RPC_URL,
  ETHSTORAGE_RPC,
  JOURNAL_CONTRACT,
  FLAT_KEY,
  CHUNK_SIZE,
  paperJsonFile: "analysis/files/hexs/2603.25100v1.json",
});
await maxRunner.batch("analysis/files/event-2603.25100v1.csv");

const medianRunner = new PipelineRunner({
  PRIVATE_KEY,
  RPC_URL,
  ETHSTORAGE_RPC,
  JOURNAL_CONTRACT,
  FLAT_KEY,
  CHUNK_SIZE,
  paperJsonFile: "analysis/files/hexs/2604.09731v1.json",
});
medianRunner.batch("analysis/files/event-2604.09731v1.csv");
