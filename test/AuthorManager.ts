import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress } from "viem";

describe("AuthorManager", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  async function deployFixture() {
    const authorManager = await viem.deployContract("AuthorManager");
    const [owner, otherAccount] = await viem.getWalletClients();

    return {
      authorManager,
      owner: owner.account,
      otherAccount: otherAccount.account,
    };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { authorManager, owner } = await deployFixture();

      assert.equal(await authorManager.read.owner(), getAddress(owner.address));
    });
  });

  describe("Add&Get", function () {
    describe("Validations", function () {
      it("Should add author with all fields correctly", async function () {
        const { authorManager, owner } = await deployFixture();

        await authorManager.write.add([
          "John",
          "Doe",
          "john.doe@example.com",
          "10.1234/example.2023",
        ]);

        const author = await authorManager.read.get([0n]);

        assert.equal(author.firstName, "John");
        assert.equal(author.lastName, "Doe");
        assert.equal(author.email, "john.doe@example.com");
        assert.equal(author.doi, "10.1234/example.2023");
        assert.equal(author.user, getAddress(owner.address));
        assert.equal(typeof author.timestamp, "bigint");
      });

      it("Should add author without DOI correctly", async function () {
        const { authorManager, owner } = await deployFixture();

        await authorManager.write.add(["Jane", "Smith", "jane.smith@example.com"]);

        const author = await authorManager.read.get([0n]);

        assert.equal(author.firstName, "Jane");
        assert.equal(author.lastName, "Smith");
        assert.equal(author.email, "jane.smith@example.com");
        assert.equal(author.doi, "");
        assert.equal(author.user, getAddress(owner.address));
      });

      it("Should increment total count after adding", async function () {
        const { authorManager } = await deployFixture();

        assert.equal(await authorManager.read.getTotal(), 0n);

        await authorManager.write.add(["John", "Doe", "john@example.com"]);
        assert.equal(await authorManager.read.getTotal(), 1n);

        await authorManager.write.add(["Jane", "Smith", "jane@example.com"]);
        assert.equal(await authorManager.read.getTotal(), 2n);

        const list = await authorManager.read.getList();
        assert.equal(list.length, 2);
      });
    });

    describe("Update", function () {
      it("Should update author information partially", async function () {
        const { authorManager } = await deployFixture();

        await authorManager.write.add(["John", "Doe", "john@example.com", "10.1234/old.2023"]);

        await authorManager.write.set([
          {
            idx: 0n,
            firstName: "",
            lastName: "",
            email: "john.new@example.com",
            doi: "10.1234/new.2023",
          },
        ]);

        const author = await authorManager.read.get([0n]);
        assert.equal(author.firstName, "John"); // unchanged
        assert.equal(author.lastName, "Doe"); // unchanged
        assert.equal(author.email, "john.new@example.com"); // updated
        assert.equal(author.doi, "10.1234/new.2023"); // updated
      });

      it("Should revert when updating non-existent author", async function () {
        const { authorManager } = await deployFixture();

        await assert.rejects(
          authorManager.write.set([
            {
              idx: 0n,
              firstName: "John",
              lastName: "Doe",
              email: "john@example.com",
              doi: "10.1234/example.2023",
            },
          ]),
          /Author index out of bounds/,
        );
      });
    });

    describe("Events", function () {
      it("Should emit an event on author added", async function () {
        const { authorManager, owner } = await deployFixture();

        await viem.assertions.emitWithArgs(
          authorManager.write.add(["John", "Doe", "john@example.com"]),
          authorManager,
          "authorAdded",
          [0n, getAddress(owner.address)], // 假设第一个参数是authorId，第二个是user
        );
      });

      it("Should track all author added events", async function () {
        const { authorManager, owner } = await deployFixture();
        const deploymentBlockNumber = await publicClient.getBlockNumber();

        // 添加多个作者
        await authorManager.write.add(["John", "Doe", "john@example.com"]);
        await authorManager.write.add(["Jane", "Smith", "jane@example.com"]);
        await authorManager.write.add(["Bob", "Johnson", "bob@example.com"]);

        // 获取所有事件
        const events = await publicClient.getContractEvents({
          address: authorManager.address,
          abi: authorManager.abi,
          eventName: "authorAdded",
          fromBlock: deploymentBlockNumber,
          strict: true,
        });

        // 验证事件数量
        assert.equal(events.length, 3);

        // 验证事件内容
        for (let i = 0; i < events.length; i++) {
          const event = events[i];
          assert.equal(event.args.authorId, BigInt(i));
          assert.equal(event.args.user, getAddress(owner.address));
        }

        // 验证总数匹配
        assert.equal(await authorManager.read.getTotal(), 3n);
      });
    });
  });

  describe("Edge Cases", function () {
    it("Should handle empty string fields correctly", async function () {
      const { authorManager } = await deployFixture();

      await authorManager.write.add(["", "", "test@example.com", ""]);
      const author = await authorManager.read.get([0n]);

      assert.equal(author.firstName, "");
      assert.equal(author.lastName, "");
      assert.equal(author.email, "test@example.com");
      assert.equal(author.doi, "");
    });

    it("Should prevent accessing non-existent authors", async function () {
      const { authorManager } = await deployFixture();

      await assert.rejects(authorManager.read.get([999n]), /Author index out of bounds/);
    });

    it("Should return empty list when no authors", async function () {
      const { authorManager } = await deployFixture();

      const list = await authorManager.read.getList();
      assert.equal(list.length, 0);
      assert.equal(await authorManager.read.getTotal(), 0n);
    });
  });
});
