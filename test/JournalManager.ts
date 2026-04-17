import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network } from "hardhat";

describe("JournalManager", async () => {
  let publicClient: any;
  let walletClient: any;
  let contract: any;
  let account: any;
  let otherAccount: any;

  before(async () => {
    const { viem } = await network.connect();

    publicClient = await viem.getPublicClient();
    walletClient = await viem.getWalletClient();

    const accounts = await walletClient.getAddresses();
    account = accounts[0];
    otherAccount = accounts[1];

    // constructor(dirContract)
    contract = await viem.deployContract("JournalManager", [account]);
  });

  // ----------------------------------
  // ✅ 提交 + index 查询
  // ----------------------------------
  it("submit article and verify by index", async () => {
    const tex = ["0x" + "1".padStart(64, "0")];

    const hash = await walletClient.writeContract({
      account,
      address: contract.address,
      abi: contract.abi,
      functionName: "submitArticle",
      args: [
        "paper-1", // ✅ id
        "Test Title",
        ["Alice"],
        tex,
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

    const article = await publicClient.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "getArticle",
      args: [0n],
    });

    const [id, title, authors, texTxIDs, uri, submitter, , dirContract] = article;

    assert.equal(id, "paper-1");
    assert.equal(title, "Test Title");
    assert.equal(authors[0], "Alice");
    assert.equal(texTxIDs.length, 1);
    assert.equal(uri, "ipfs://test");
    assert.equal(submitter.toLowerCase(), account.toLowerCase());
    assert.equal(dirContract.toLowerCase(), account.toLowerCase());
  });

  // ----------------------------------
  // ✅ getArticleById
  // ----------------------------------
  it("should query by string id", async () => {
    const article = await publicClient.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "getArticleById",
      args: ["paper-1"],
    });

    const [title, authors] = article;

    assert.equal(title, "Test Title");
    assert.equal(authors[0], "Alice");
  });

  // ----------------------------------
  // ❌ duplicate id
  // ----------------------------------
  it("should fail on duplicate id", async () => {
    let failed = false;

    try {
      await walletClient.writeContract({
        account,
        address: contract.address,
        abi: contract.abi,
        functionName: "submitArticle",
        args: [
          "paper-1", // ❌ duplicate
          "Another",
          ["Bob"],
          ["0x" + "2".padStart(64, "0")],
          "",
        ],
      });
    } catch (e) {
      failed = true;
    }

    assert.equal(failed, true);
  });

  // ----------------------------------
  // ❌ empty id
  // ----------------------------------
  it("should fail when id empty", async () => {
    let failed = false;

    try {
      await walletClient.writeContract({
        account,
        address: contract.address,
        abi: contract.abi,
        functionName: "submitArticle",
        args: ["", "Test", ["Alice"], ["0x" + "1".padStart(64, "0")], ""],
      });
    } catch (e) {
      failed = true;
    }

    assert.equal(failed, true);
  });

  // ----------------------------------
  // ❌ empty TEX
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
          "paper-2",
          "Test",
          ["Alice"],
          [], // ❌
          "",
        ],
      });
    } catch (e) {
      failed = true;
    }

    assert.equal(failed, true);
  });

  // ----------------------------------
  // 🔧 setDirContract
  // ----------------------------------
  it("owner can update dirContract", async () => {
    const newDir = otherAccount;

    const hash = await walletClient.writeContract({
      account,
      address: contract.address,
      abi: contract.abi,
      functionName: "setDirContract",
      args: [newDir],
    });

    await publicClient.waitForTransactionReceipt({ hash });

    const dir = await publicClient.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "dirContract",
    });

    assert.equal(dir.toLowerCase(), newDir.toLowerCase());
  });

  // ----------------------------------
  // ❌ non-owner update
  // ----------------------------------
  it("non-owner cannot update dirContract", async () => {
    let failed = false;

    try {
      await walletClient.writeContract({
        account: otherAccount,
        address: contract.address,
        abi: contract.abi,
        functionName: "setDirContract",
        args: [account],
      });
    } catch (e) {
      failed = true;
    }

    assert.equal(failed, true);
  });

  // ----------------------------------
  // 📊 gas scaling
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
        args: [`paper-gas-${n}`, "Test", ["Alice"], tex, ""],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      console.log(`chunks=${n}, gas=${receipt.gasUsed}`);
    }
  });
});
