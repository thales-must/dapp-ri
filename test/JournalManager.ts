import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network } from "hardhat";

describe("JournalManager", async () => {
  let publicClient: any;
  let walletClient: any;
  let contract: any;
  let account: any;

  before(async () => {
    const { viem } = await network.connect();

    publicClient = await viem.getPublicClient();
    walletClient = await viem.getWalletClient();

    const accounts = await walletClient.getAddresses();
    account = accounts[0];

    contract = await viem.deployContract("JournalManager", []);
  });

  // ----------------------------------
  // ✅ 基本提交
  // ----------------------------------
  it("submit article", async () => {
    const hash = await walletClient.writeContract({
      account,
      address: contract.address,
      abi: contract.abi,
      functionName: "submitArticle",
      args: [
        "Test Title",
        ["Alice"],
        ["blockchain"],
        ["0x" + "1".padStart(64, "0")],
        account,
        "0x1234",
        "ipfs://test",
      ],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    assert.equal(receipt.status, "success");

    const count = await publicClient.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "articleCount",
    });

    assert.equal(count, 1n);
  });

  // ----------------------------------
  // ❌ 空 TEX
  // ----------------------------------
  it("should fail when TEX empty", async () => {
    let failed = false;

    try {
      await walletClient.writeContract({
        account,
        address: contract.address,
        abi: contract.abi,
        functionName: "submitArticle",
        args: [
          "Test",
          ["Alice"],
          ["blockchain"],
          [], // ❌ empty
          account,
          "0x",
          "",
        ],
      });
    } catch (e) {
      failed = true;
    }

    assert.equal(failed, true);
  });

  // ----------------------------------
  // 📊 GAS 测试
  // ----------------------------------
  it("gas scaling", async () => {
    for (const n of [1, 5, 10, 20]) {
      const tex = Array.from(
        { length: n },
        (_, i) => "0x" + (i + 1).toString(16).padStart(64, "0"),
      );

      const hash = await walletClient.writeContract({
        account,
        address: contract.address,
        abi: contract.abi,
        functionName: "submitArticle",
        args: [`Test-${n}`, ["Alice"], ["test"], tex, account, "0x", ""],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      console.log(`chunks=${n}, gas=${receipt.gasUsed}`);
    }
  });
});
