import { createWalletClient, createPublicClient, http, encodeFunctionData } from "viem";
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
const JOURNAL_CONTRACT = process.env.JOURNAL_CONTRACT as `0x${string}`;

const rawData = fs.readFileSync(process.env.PAPER_JSON_FILE!, "utf-8");
const paper = JSON.parse(rawData);

const args = [
  "A Lightweight Hybrid Publish/Subscribe Event Fabric for IPC and Modular Distributed Systems",
  ["Dimitris Gkoulis"],
  ["0x32aa59bad54edd9c00ddb64e27e67d27bc59fc3f85fb0d9a2c9bf5aa4b9f8e29"],
  "https://arxiv.org/abs/2603.30030v1",
];
function getArticle(values: string[]): Object {
  const keys = ["title", "authors", "texTxIds", "extraMetadataURI"];
  return keys.reduce(
    (acc, key, index) => {
      acc[key] = values[index];
      return acc;
    },
    {} as Record<string, string | number>,
  );
}
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

  // const articleCount = await publicClient.readContract({
  //   address: JOURNAL_CONTRACT,
  //   abi: artifact.abi,
  //   functionName: "dirContract",
  //   args: [],
  // });
  // console.log(articleCount);

  // const gas = await publicClient.estimateContractGas({
  //   address: JOURNAL_CONTRACT,
  //   abi: artifact.abi,
  //   functionName: "submitArticle",
  //   args,
  // });
  // console.log("submitHash:", gas);

  // const submitHash = await wallet.writeContract({
  //   address: JOURNAL_CONTRACT,
  //   abi: artifact.abi,
  //   functionName: "submitArticle",
  //   args,
  // });
  // console.log("submitHash:", submitHash);
  const submitHash = "0xd9828990ce0c5ab7b4770e8ad14ce4d55001d0af57c39e071cbf820d88fd46f2";
  // 等待交易确认后获取收据
  const receipt = await publicClient.waitForTransactionReceipt({ hash: submitHash });

  // 获取交易的 input 数据
  const transaction = await publicClient.getTransaction({ hash: submitHash });
  const calldata = transaction.input;
  const calldataSize = (calldata.length - 2) / 2;
  console.log(`Calldata 大小: ${calldataSize} bytes`);

  // const articleCount = await publicClient.readContract({
  //   address: JOURNAL_CONTRACT,
  //   abi: artifact.abi,
  //   functionName: "articleCount",
  //   args: [],
  // });

  // const articleArray = await publicClient.readContract({
  //   address: JOURNAL_CONTRACT,
  //   abi: artifact.abi,
  //   functionName: "getArticle",
  //   args: [articleCount - 1n],
  // });
  // const article = getArticle(articleArray);

  // console.log("getArticle:", getArticle(articleArray).texTxIds);
  // const balance = await publicClient.getBalance({
  //   address: account.address,
  // });
  // console.log(balance);
}
main().catch(console.error);
