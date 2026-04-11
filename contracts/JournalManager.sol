// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract JournalManager {
    // ----------------------------
    // Article Structure
    // ----------------------------
    struct Article {
        string title;
        string[] authors;
        string[] keywords;
        address submitter;
        uint256 timestamp;
        bytes32[] texTxIds;
        address dirContract;
        bytes encryptedKey;
        string extraMetadataURI;
    }

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
    // ✅ External Interface（🔥关键修改点）
    // ----------------------------
    function submitArticle(
        string calldata title,
        string[] calldata authors,
        string[] calldata keywords,
        bytes32[] calldata texTxIds,
        address dirContract,
        bytes calldata encryptedKey,
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

        // --- Keywords ---
        for (uint256 i = 0; i < keywords.length; i++) {
            a.keywords.push(keywords[i]);
        }

        // --- TEX ---
        for (uint256 i = 0; i < texTxIds.length; i++) {
            a.texTxIds.push(texTxIds[i]);
        }

        // --- Directory Contract ---
        a.dirContract = dirContract;

        // --- Encryption ---
        a.encryptedKey = encryptedKey;

        // --- Extra metadata ---
        a.extraMetadataURI = extraMetadataURI;

        articleCount++;

        emit ArticleSubmitted(articleId, msg.sender, title);

        return articleId;
    }

    // ----------------------------
    // View: Metadata
    // ----------------------------
    function getArticle(
        uint256 articleId
    )
        external
        view
        returns (
            string memory title,
            string[] memory authors,
            string[] memory keywords,
            bytes32[] memory texTxIds,
            address dirContract,
            bytes memory encryptedKey,
            string memory extraMetadataURI,
            address submitter,
            uint256 timestamp
        )
    {
        Article storage a = articles[articleId];
        return (
            a.title,
            a.authors,
            a.keywords,
            a.texTxIds,
            a.dirContract,
            a.encryptedKey,
            a.extraMetadataURI,
            a.submitter,
            a.timestamp
        );
    }

    // ----------------------------
    // View: TEX txIds
    // ----------------------------
    function getTexTxIds(uint256 articleId) external view returns (bytes32[] memory) {
        return articles[articleId].texTxIds;
    }

    // ----------------------------
    // View: Encrypted Key
    // ----------------------------
    function getEncryptedKey(uint256 articleId) external view returns (bytes memory) {
        return articles[articleId].encryptedKey;
    }

    // ----------------------------
    // View: Extra Metadata
    // ----------------------------
    function getExtraMetadataURI(uint256 articleId) external view returns (string memory) {
        return articles[articleId].extraMetadataURI;
    }
}
