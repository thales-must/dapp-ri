// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract JournalManager {
    // ----------------------------
    // Asset Structure
    // ----------------------------
    struct Asset {
        string path; // e.g., "figures/fig1.png"
        bytes32 storageId; // EthStorage hash or similar
    }

    // ----------------------------
    // Article Structure
    // ----------------------------
    struct Article {
        // --- Metadata ---
        string title;
        string[] authors;
        address submitter;
        uint256 timestamp;
        // --- TEX Reconstruction ---
        bytes32[] texTxIds; // calldata tx hashes
        // --- Assets Mapping ---
        Asset[] assets;
        // --- Encrypted Key (optional) ---
        bytes encryptedKey;
        // --- Optional external metadata ---
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
    // Submit Article (FULL PIPELINE)
    // ----------------------------
    function submitArticle(
        string calldata _title,
        string[] calldata _authors,
        bytes32[] calldata _texTxIds,
        Asset[] calldata _assets,
        bytes calldata _encryptedKey,
        string calldata _extraMetadataURI
    ) external returns (uint256) {
        require(_texTxIds.length > 0, "Empty TEX");

        uint256 articleId = articleCount;
        Article storage a = articles[articleId];

        // --- Metadata ---
        a.title = _title;
        a.authors = _authors;
        a.submitter = msg.sender;
        a.timestamp = block.timestamp;

        // --- TEX ---
        a.texTxIds = _texTxIds;

        // --- Assets ---
        for (uint256 i = 0; i < _assets.length; i++) {
            a.assets.push(_assets[i]);
        }

        // --- Encryption ---
        a.encryptedKey = _encryptedKey;

        // --- Extra metadata ---
        a.extraMetadataURI = _extraMetadataURI;

        articleCount++;

        emit ArticleSubmitted(articleId, msg.sender, _title);

        return articleId;
    }

    // ----------------------------
    // View: Basic Metadata
    // ----------------------------
    function getArticleBasic(
        uint256 articleId
    )
        external
        view
        returns (string memory title, string[] memory authors, address submitter, uint256 timestamp)
    {
        Article storage a = articles[articleId];
        return (a.title, a.authors, a.submitter, a.timestamp);
    }

    // ----------------------------
    // View: TEX txIds
    // ----------------------------
    function getTexTxIds(uint256 articleId) external view returns (bytes32[] memory) {
        return articles[articleId].texTxIds;
    }

    // ----------------------------
    // View: Asset Count
    // ----------------------------
    function getAssetCount(uint256 articleId) external view returns (uint256) {
        return articles[articleId].assets.length;
    }

    // ----------------------------
    // View: Single Asset (分页防止爆gas)
    // ----------------------------
    function getAssetByIndex(
        uint256 articleId,
        uint256 index
    ) external view returns (string memory path, bytes32 storageId) {
        Asset storage asset = articles[articleId].assets[index];
        return (asset.path, asset.storageId);
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
