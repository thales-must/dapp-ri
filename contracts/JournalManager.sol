// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract JournalManager {
    // ----------------------------
    // Article Structure（极简版）
    // ----------------------------
    struct Article {
        string title;
        string[] authors;
        address submitter;
        uint256 timestamp;
        bytes32[] texTxIds;
        string extraMetadataURI;
    }

    // ----------------------------
    // Global Config（🔥关键优化）
    // ----------------------------
    address public immutable dirContract;

    // ----------------------------
    // Storage
    // ----------------------------
    uint256 public articleCount;
    mapping(uint256 => Article) private articles;

    // ----------------------------
    // Events
    // ----------------------------
    event ArticleSubmitted(uint256 indexed articleId, address indexed submitter, string title);

    // ----------------------------
    // Constructor（🔥只部署一次）
    // ----------------------------
    constructor(address _dirContract) {
        require(_dirContract != address(0), "Invalid dir");
        dirContract = _dirContract;
    }

    // ----------------------------
    // Submit Article（🔥极简 + 低gas）
    // ----------------------------
    function submitArticle(
        string calldata title,
        string[] calldata authors,
        bytes32[] calldata texTxIds,
        string calldata extraMetadataURI
    ) external returns (uint256) {
        require(texTxIds.length > 0, "Empty TEX");

        uint256 articleId = articleCount;
        Article storage a = articles[articleId];

        // --- Metadata ---
        a.title = title;
        a.submitter = msg.sender;
        a.timestamp = block.timestamp;

        // --- Authors ---
        for (uint256 i = 0; i < authors.length; i++) {
            a.authors.push(authors[i]);
        }

        // --- TEX ---
        for (uint256 i = 0; i < texTxIds.length; i++) {
            a.texTxIds.push(texTxIds[i]);
        }

        // --- Extra metadata ---
        a.extraMetadataURI = extraMetadataURI;

        articleCount++;

        emit ArticleSubmitted(articleId, msg.sender, title);

        return articleId;
    }

    // ----------------------------
    // View: Full Article（🔥统一接口）
    // ----------------------------
    function getArticle(
        uint256 articleId
    )
        external
        view
        returns (
            string memory title,
            string[] memory authors,
            bytes32[] memory texTxIds,
            string memory extraMetadataURI,
            address submitter,
            uint256 timestamp
        )
    {
        Article storage a = articles[articleId];
        return (a.title, a.authors, a.texTxIds, a.extraMetadataURI, a.submitter, a.timestamp);
    }

    // ----------------------------
    // View: TEX txIds
    // ----------------------------
    function getTexTxIds(uint256 articleId) external view returns (bytes32[] memory) {
        return articles[articleId].texTxIds;
    }

    // ----------------------------
    // View: Extra Metadata
    // ----------------------------
    function getExtraMetadataURI(uint256 articleId) external view returns (string memory) {
        return articles[articleId].extraMetadataURI;
    }
}
