import { createWalletClient, createPublicClient, http, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

import { FlatDirectory } from "ethstorage-sdk";

// ----------------------------
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const RPC_URL = process.env.RPC_URL!;

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL),
  });

  const flatDirectory = await FlatDirectory.create({
    rpc: RPC_URL,
    privateKey: PRIVATE_KEY,
  });

  const deployStart = await publicClient.getBlockNumber();
  const dirContract = await flatDirectory.deploy();
  const deployEnd = await publicClient.getBlockNumber();

  console.log(`contract: ${dirContract}`);

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
  console.log(`gas: ${deployGas}`);
}
main().catch(console.error);
