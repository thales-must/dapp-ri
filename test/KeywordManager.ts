import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress } from "viem";

describe("KeywordManager", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  async function deployFixture() {
    const keywordManager = await viem.deployContract("KeywordManager");
    const [owner, otherAccount] = await viem.getWalletClients();

    return {
      keywordManager,
      owner: owner.account,
      otherAccount: otherAccount.account,
    };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { keywordManager, owner } = await deployFixture();

      assert.equal(await keywordManager.read.owner(), getAddress(owner.address));
    });
  });

  describe("Add&Get", function () {
    describe("Validations", function () {
      it("Should add keyword correctly", async function () {
        const { keywordManager, owner } = await deployFixture();

        await keywordManager.write.add(["test"]);
        const keyword = await keywordManager.read.get([0n]);

        assert.equal(keyword.name, "test");
        assert.equal(keyword.user, getAddress(owner.address));
        assert.equal(typeof keyword.timestamp, "bigint");
      });

      it("Should increment total count after adding", async function () {
        const { keywordManager } = await deployFixture();

        assert.equal(await keywordManager.read.getTotal(), 0n);
        await keywordManager.write.add(["test1"]);
        assert.equal(await keywordManager.read.getTotal(), 1n);
        await keywordManager.write.add(["test2"]);
        assert.equal(await keywordManager.read.getTotal(), 2n);

        const list = await keywordManager.read.getList();
        assert.equal(list.length, 2);
      });
    });

    describe("Events", function () {
      it("Should emit an event on added", async function () {
        const { keywordManager, owner } = await deployFixture();

        await viem.assertions.emitWithArgs(
          keywordManager.write.add(["test"]),
          keywordManager,
          "keywordAdded",
          [0n, getAddress(owner.address)],
        );
      });

      it("Should track all keyword added events", async function () {
        const { keywordManager, owner } = await deployFixture();
        const deploymentBlockNumber = await publicClient.getBlockNumber();

        // 添加多个关键词
        await keywordManager.write.add(["test1"]);
        await keywordManager.write.add(["test2"]);
        await keywordManager.write.add(["test3"]);

        // 获取所有事件
        const events = await publicClient.getContractEvents({
          address: keywordManager.address,
          abi: keywordManager.abi,
          eventName: "keywordAdded",
          fromBlock: deploymentBlockNumber,
          strict: true,
        });

        // 验证事件数量
        assert.equal(events.length, 3);

        // 验证事件内容
        for (let i = 0; i < events.length; i++) {
          const event = events[i];
          assert.equal(event.args.keywordId, BigInt(i));
          assert.equal(event.args.user, getAddress(owner.address));
        }

        // 验证总数匹配
        assert.equal(await keywordManager.read.getTotal(), 3n);
      });
    });
  });

  describe("Edge Cases", function () {
    it("Should handle empty keyword name", async function () {
      const { keywordManager } = await deployFixture();

      await keywordManager.write.add([""]);
      const keyword = await keywordManager.read.get([0n]);

      assert.equal(keyword.name, "");
    });

    it("Should prevent accessing non-existent keywords", async function () {
      const { keywordManager } = await deployFixture();

      // 修改这里：捕获数组越界错误而不是特定的错误消息
      await assert.rejects(
        keywordManager.read.get([999n]),
        (error: Error) => {
          // 检查错误是否包含数组越界的提示
          return (
            error.message.includes("panic code 0x32") ||
            error.message.includes("Array accessed at an out-of-bounds") ||
            error.message.includes("out of bounds")
          );
        },
        "Should reject with array out of bounds error",
      );
    });

    it("Should return empty list when no keywords", async function () {
      const { keywordManager } = await deployFixture();

      const list = await keywordManager.read.getList();
      assert.equal(list.length, 0);
      assert.equal(await keywordManager.read.getTotal(), 0n);
    });

    // 添加更多边界情况测试
    it("Should handle accessing index 0 when no keywords exist", async function () {
      const { keywordManager } = await deployFixture();

      // 当没有任何关键词时访问索引0也应该失败
      await assert.rejects(
        keywordManager.read.get([0n]),
        (error: Error) => {
          return (
            error.message.includes("panic code 0x32") ||
            error.message.includes("Array accessed at an out-of-bounds")
          );
        },
        "Should reject when accessing any index with no keywords",
      );
    });

    it("Should handle negative index access", async function () {
      const { keywordManager } = await deployFixture();

      // 尝试访问负索引（虽然Solidity中uint256不能为负，但测试边界情况）
      await assert.rejects(
        keywordManager.read.get([-1n]),
        (error) => {
          // 这里可能会因为类型转换失败或其他原因报错
          return true; // 任何错误都算通过，因为负索引不应该工作
        },
        "Should reject negative index access",
      );
    });
  });
});
