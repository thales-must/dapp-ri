import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { encodeFunctionData, parseEther, createWalletClient, createPublicClient, http } from "viem";

describe("CalldataBenchmark", async () => {
  const { viem } = await network.connect();

  let publicClient: any;
  let walletClient: any;
  let contractAddress: `0x${string}`;
  let account: any;

  const abi = [
    {
      name: "submit",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [{ name: "data", type: "bytes" }],
      outputs: [],
    },
  ];

  function makeHex(size: number): `0x${string}` {
    // 生成指定 byte 长度的随机数据
    const arr = new Uint8Array(size);
    crypto.getRandomValues(arr);
    return ("0x" +
      Array.from(arr)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")) as `0x${string}`;
  }

  it("should measure calldata gas", async () => {
    // ===== 部署合约 =====
    const contract = await viem.deployContract("CalldataBenchmark", []);
    contractAddress = contract.address;

    // ===== client =====
    [account] = await viem.getWalletClients();
    publicClient = await viem.getPublicClient();

    // ===== 测试不同大小 =====
    const sizes = [128, 256, 512, 1024, 2048];

    for (const size of sizes) {
      const data = makeHex(size);

      const hash = await account.writeContract({
        address: contractAddress,
        abi,
        functionName: "submit",
        args: [data],
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
      });

      console.log(`size=${size} bytes | gasUsed=${receipt.gasUsed.toString()}`);

      assert.ok(receipt.gasUsed > 0n);
    }
  });
});
