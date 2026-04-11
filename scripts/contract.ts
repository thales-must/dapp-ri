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

const rawData = fs.readFileSync(process.env.PAPER_JSON_FILE, "utf-8");
const paper = JSON.parse(rawData);

const args = [
  "A Lightweight Hybrid Publish/Subscribe Event Fabric for IPC and Modular Distributed Systems",
  ["Dimitris Gkoulis"],
  [
    "event-driven systems",
    "local-first messaging",
    "inter-process communication",
    "NATS",
    "structured routing",
    "publish/subscribe",
    "microservices",
  ],
  ["0x32aa59bad54edd9c00ddb64e27e67d27bc59fc3f85fb0d9a2c9bf5aa4b9f8e29"],
  "0xDE6A9eFF04d9c6dBfd5F256B44B6FB0a40e109a8",
  "0x8c2d7ba7c6d090f5b94002c92632a8b7e72be553f2b0be4ef566a37c80b09d33b2407dd24c1ac87705e8354bcff353551283ffca48da5689c6a28787eccd2574df77dcdb7d64bdf1dec1294eae70514999cde4f4be3331943ddfa0e337680dd77445a678cc1231ea9df0bceb37a1cdeea0381240c3f810fea503ab570f826fec559ce5c62f177b9e7d2ccc81d0a0441cfb98053eebe4085f36fddff02254fdf5f7596d362acd48865d9861ae3684fb87a90910ad0483beb2f3946a5c66a1f963664f42345947049c00cc09ffeb57900fcb6e136c566567040f002ba25010d5eff70e88f48e03f46b6ebc108da3ab9cd1a49afed1eb259584f44eef6bcdc3e8e5",
  "https://arxiv.org/abs/2603.30030v1",
];
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

  // const submitHash = await wallet.writeContract({
  //   address: JOURNAL_CONTRACT,
  //   abi: artifact.abi,
  //   functionName: "submitArticle",
  //   args,
  // });
  // console.log("submitHash:", submitHash);

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

  console.log("getArticle:", getArticle(articleArray).texTxIds);
  const balance = await publicClient.getBalance({
    address: account.address,
  });
  console.log(balance);
}
main().catch(console.error);
