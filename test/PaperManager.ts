import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress } from "viem";
import { anyValue } from "@nomicfoundation/hardhat-viem-assertions/predicates";

type AuthorInput = {
  firstName: string;
  lastName: string;
  email: string;
  doi?: string;
};

describe("PaperManager", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  async function deployFixture() {
    const paperManager = await viem.deployContract("PaperManager");
    const authorManager = await viem.deployContract("AuthorManager");
    const keywordManager = await viem.deployContract("KeywordManager");
    const [owner, otherAccount] = await viem.getWalletClients();

    return {
      paperManager,
      authorManager,
      keywordManager,
      owner: owner.account,
      otherAccount: otherAccount.account,
    };
  }

  async function createAuthor(
    authorManager: Awaited<ReturnType<typeof deployFixture>>["authorManager"],
    author: AuthorInput,
  ): Promise<bigint> {
    await authorManager.write.add([
      author.firstName,
      author.lastName,
      author.email,
      author.doi ?? "",
    ]);

    const total = await authorManager.read.getTotal();
    return total - 1n;
  }

  async function createKeyword(
    keywordManager: Awaited<ReturnType<typeof deployFixture>>["keywordManager"],
    keyword: string,
  ): Promise<bigint> {
    await keywordManager.write.add([keyword]);
    const total = await keywordManager.read.getTotal();
    return total - 1n;
  }

  function toPaperAuthors(authorIds: bigint[]) {
    return authorIds.map((id, idx) => ({
      authorId: id,
      isFirstAuthor: idx === 0,
      isCorrespondingAuthor: idx === 0,
    }));
  }

  describe("Paper Creation", function () {
    it("Should create paper that references contract-stored authors & keywords", async function () {
      const { paperManager, authorManager, keywordManager, owner } = await deployFixture();

      const primaryAuthorId = await createAuthor(authorManager, {
        firstName: "Alice",
        lastName: "Zhang",
        email: "alice@example.com",
      });
      const coAuthorId = await createAuthor(authorManager, {
        firstName: "Bob",
        lastName: "Lee",
        email: "bob@example.com",
      });

      const quantumKeywordId = await createKeyword(keywordManager, "quantum");
      const defiKeywordId = await createKeyword(keywordManager, "defi");

      await paperManager.write.createPaper([
        "Cross-domain research",
        "A paper that mixes quantum and defi.",
        ["Intro", "Body", "Conclusion"],
        [
          {
            authorId: primaryAuthorId,
            isFirstAuthor: true,
            isCorrespondingAuthor: true,
          },
          {
            authorId: coAuthorId,
            isFirstAuthor: false,
            isCorrespondingAuthor: false,
          },
        ],
        [quantumKeywordId, defiKeywordId],
      ]);

      const paper = await paperManager.read.getPaper([0n]);

      assert.equal(paper.title, "Cross-domain research");
      assert.equal(paper.abstractText, "A paper that mixes quantum and defi.");
      assert.deepEqual(paper.sections, ["Intro", "Body", "Conclusion"]);
      assert.equal(paper.creator, getAddress(owner.address));

      const authors = await paperManager.read.getPaperAuthors([0n]);
      const keywordIds = await paperManager.read.getPaperKeywordIds([0n]);

      assert.deepEqual(authors, [
        {
          authorId: primaryAuthorId,
          isFirstAuthor: true,
          isCorrespondingAuthor: true,
        },
        {
          authorId: coAuthorId,
          isFirstAuthor: false,
          isCorrespondingAuthor: false,
        },
      ]);
      assert.deepEqual(keywordIds, [quantumKeywordId, defiKeywordId]);
    });

    it("Should reject paper creation without authors", async function () {
      const { paperManager } = await deployFixture();

      await assert.rejects(
        paperManager.write.createPaper([
          "Missing authors",
          "No authors set",
          ["Only section"],
          [],
          [],
        ]),
        /Must provide at least one author/,
      );
    });

    it("Should only allow the owner to create papers", async function () {
      const { paperManager, otherAccount, authorManager, keywordManager } = await deployFixture();

      const authorId = await createAuthor(authorManager, {
        firstName: "Carol",
        lastName: "Wang",
        email: "carol@example.com",
      });
      const keywordId = await createKeyword(keywordManager, "ai");

      await assert.rejects(
        paperManager.write.createPaper(
          [
            "Unauthorized",
            "Attempt by non-owner",
            ["Section"],
            [
              {
                authorId,
                isFirstAuthor: true,
                isCorrespondingAuthor: true,
              },
            ],
            [keywordId],
          ],
          {
            account: otherAccount,
          },
        ),
        /Only owner can perform this action/,
      );
    });
  });

  describe("Events", function () {
    it("Should emit PaperCreated when a paper is created", async function () {
      const { paperManager, authorManager, keywordManager } = await deployFixture();

      const authorId = await createAuthor(authorManager, {
        firstName: "Event",
        lastName: "Tester",
        email: "event@example.com",
      });
      const keywordId = await createKeyword(keywordManager, "event");

      await viem.assertions.emitWithArgs(
        paperManager.write.createPaper([
          "Event Paper",
          "Event Abstract",
          ["Section"],
          toPaperAuthors([authorId]),
          [keywordId],
        ]),
        paperManager,
        "PaperCreated",
        [
          0n,
          "Event Paper",
          getAddress((await viem.getWalletClients())[0].account.address),
          anyValue,
        ],
      );
    });

    it("Should be able to query historical PaperCreated events", async function () {
      const { paperManager, authorManager, keywordManager, owner } = await deployFixture();
      const deploymentBlockNumber = await publicClient.getBlockNumber();

      const authorId = await createAuthor(authorManager, {
        firstName: "History",
        lastName: "Writer",
        email: "history@example.com",
      });
      const keywordId = await createKeyword(keywordManager, "history");

      await paperManager.write.createPaper([
        "History 1",
        "Abstract 1",
        ["S1"],
        toPaperAuthors([authorId]),
        [keywordId],
      ]);
      await paperManager.write.createPaper([
        "History 2",
        "Abstract 2",
        ["S2"],
        toPaperAuthors([authorId]),
        [keywordId],
      ]);

      const events = await publicClient.getContractEvents({
        address: paperManager.address,
        abi: paperManager.abi,
        eventName: "PaperCreated",
        fromBlock: deploymentBlockNumber,
        strict: true,
      });

      assert.equal(events.length, 2);
      events.forEach((event, index) => {
        assert.equal(event.args.paperId, BigInt(index));
        assert.equal(event.args.author, getAddress(owner.address));
      });
    });
  });

  describe("Retrieval", function () {
    it("Should retrieve sections, authors and keywords", async function () {
      const { paperManager, authorManager, keywordManager } = await deployFixture();

      const authorId = await createAuthor(authorManager, {
        firstName: "Reader",
        lastName: "One",
        email: "reader@example.com",
      });

      const keywordA = await createKeyword(keywordManager, "section-test");
      const keywordB = await createKeyword(keywordManager, "solidity");

      await paperManager.write.createPaper([
        "Readable Paper",
        "Readable Abstract",
        ["Intro", "Chapter 1", "Chapter 2"],
        toPaperAuthors([authorId]),
        [keywordA, keywordB],
      ]);

      const section = await paperManager.read.getSection([0n, 2n]);
      assert.equal(section, "Chapter 2");
      assert.equal(await paperManager.read.getSectionCount([0n]), 3n);

      const authors = await paperManager.read.getPaperAuthors([0n]);
      const keywords = await paperManager.read.getPaperKeywordIds([0n]);

      assert.equal(authors.length, 1);
      assert.equal(authors[0].authorId, authorId);
      assert.deepEqual(keywords, [keywordA, keywordB]);
    });

    it("Should expose basic info tuple", async function () {
      const { paperManager, authorManager, keywordManager, owner } = await deployFixture();

      const authorId = await createAuthor(authorManager, {
        firstName: "Basic",
        lastName: "Info",
        email: "basic@example.com",
      });
      const keywordId = await createKeyword(keywordManager, "basic");

      await paperManager.write.createPaper([
        "Basic Paper",
        "Basic Abstract",
        ["Section"],
        toPaperAuthors([authorId]),
        [keywordId],
      ]);

      const [id, title, abstractText, creator, createdAt] =
        await paperManager.read.getPaperBasicInfo([0n]);

      assert.equal(id, 0n);
      assert.equal(title, "Basic Paper");
      assert.equal(abstractText, "Basic Abstract");
      assert.equal(creator, getAddress(owner.address));
      assert.equal(typeof createdAt, "bigint");
    });

    it("Should allow public reads for anyone", async function () {
      const { paperManager, authorManager, keywordManager, otherAccount } = await deployFixture();

      const authorId = await createAuthor(authorManager, {
        firstName: "Public",
        lastName: "Reader",
        email: "public@example.com",
      });
      const keywordId = await createKeyword(keywordManager, "public");

      await paperManager.write.createPaper([
        "Public Paper",
        "Public Abstract",
        ["Section"],
        toPaperAuthors([authorId]),
        [keywordId],
      ]);

      const paper = await paperManager.read.getPaper([0n], {
        account: otherAccount,
      });

      assert.equal(paper.title, "Public Paper");
    });
  });

  describe("Ownership", function () {
    it("Should transfer ownership", async function () {
      const { paperManager, owner, otherAccount } = await deployFixture();

      await viem.assertions.emitWithArgs(
        paperManager.write.transferOwnership([otherAccount.address], {
          account: owner,
        }),
        paperManager,
        "OwnershipTransferred",
        [getAddress(owner.address), getAddress(otherAccount.address)],
      );

      assert.equal(await paperManager.read.owner(), getAddress(otherAccount.address));
    });

    it("Should renounce ownership", async function () {
      const { paperManager, owner } = await deployFixture();

      await viem.assertions.emitWithArgs(
        paperManager.write.renounceOwnership({
          account: owner,
        }),
        paperManager,
        "OwnershipTransferred",
        [getAddress(owner.address), "0x0000000000000000000000000000000000000000"],
      );

      assert.equal(await paperManager.read.owner(), "0x0000000000000000000000000000000000000000");
    });
  });

  describe("Edge Cases", function () {
    it("Should reject invalid section index", async function () {
      const { paperManager, authorManager, keywordManager } = await deployFixture();

      const authorId = await createAuthor(authorManager, {
        firstName: "Edge",
        lastName: "Case",
        email: "edge@example.com",
      });
      const keywordId = await createKeyword(keywordManager, "edge");

      await paperManager.write.createPaper([
        "Edge Paper",
        "Edge Abstract",
        ["Section"],
        toPaperAuthors([authorId]),
        [keywordId],
      ]);

      await assert.rejects(
        paperManager.read.getSection([0n, 5n]),
        (error: any) =>
          error.message.includes("panic code 0x32") ||
          error.message.includes("Section index out of bounds"),
      );
    });

    it("Should reject non-existent paper reads", async function () {
      const { paperManager } = await deployFixture();

      await assert.rejects(
        paperManager.read.getPaper([999n]),
        (error: any) =>
          error.message.includes("panic code 0x32") ||
          error.message.includes("Paper does not exist"),
      );
    });

    it("Should report empty totals when no papers", async function () {
      const { paperManager } = await deployFixture();

      assert.equal(await paperManager.read.getTotalPapers(), 0n);
    });
  });
});
