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

    // ✅ constructor 现在需要 dirContract
    contract = await viem.deployContract("JournalManager", [account]);
  });

  // ----------------------------------
  // ✅ 基本提交 + 读取校验
  // ----------------------------------
  it("submit article and verify storage", async () => {
    const tex = ["0x" + "1".padStart(64, "0")];

    const hash = await walletClient.writeContract({
      account,
      address: contract.address,
      abi: contract.abi,
      functionName: "submitArticle",
      args: ["Test Title", ["Alice"], tex, "ipfs://test"],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, "success");

    // ✅ articleCount
    const count = await publicClient.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "articleCount",
    });

    assert.equal(count, 1n);

    // ✅ getArticle
    const article = await publicClient.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "getArticle",
      args: [0n],
    });

    const [title, authors, texTxIds, uri, submitter] = article;

    assert.equal(title, "Test Title");
    assert.equal(authors.length, 1);
    assert.equal(authors[0], "Alice");
    assert.equal(texTxIds.length, 1);
    assert.equal(uri, "ipfs://test");
    assert.equal(submitter.toLowerCase(), account.toLowerCase());
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
          [], // ❌ empty
          "",
        ],
      });
    } catch (e) {
      failed = true;
    }

    assert.equal(failed, true);
  });

  // ----------------------------------
  // 📊 GAS scaling（核心实验）
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
        args: [`Test-${n}`, ["Alice"], tex, ""],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      console.log(`chunks=${n}, gas=${receipt.gasUsed}`);
    }
  });

  // ----------------------------------
  // 🔍 dirContract 校验（新增）
  // ----------------------------------
  it("should store dirContract correctly", async () => {
    const dir = await publicClient.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "dirContract",
    });

    assert.equal(dir.toLowerCase(), account.toLowerCase());
  });
});
