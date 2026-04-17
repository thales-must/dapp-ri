// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract JournalManager {
    // ----------------------------
    // Article Structure
    // ----------------------------
    struct Article {
        string id; // 🔥 新增：外部唯一标识（如 arxiv id）
        string title;
        string[] authors;
        address dirContract; // 🔥 每篇记录 dir
        address submitter;
        uint256 timestamp;
        bytes32[] texTxIDs;
        string extraMetadataURI;
    }

    // ----------------------------
    // Ownership（用于修改 dir）
    // ----------------------------
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ----------------------------
    // Global Config（可更新）
    // ----------------------------
    address public dirContract;

    // ----------------------------
    // Storage
    // ----------------------------
    uint256 public articleCount;

    mapping(uint256 => Article) private articles;

    // 🔥 id → articleId
    mapping(string => uint256) private idToArticle;

    // ----------------------------
    // Events
    // ----------------------------
    event ArticleSubmitted(
        uint256 indexed articleId,
        string id,
        address indexed submitter,
        string title
    );

    event DirContractUpdated(address oldDir, address newDir);

    // ----------------------------
    // Constructor
    // ----------------------------
    constructor(address _dirContract) {
        require(_dirContract != address(0), "Invalid dir");
        owner = msg.sender;
        dirContract = _dirContract;
    }

    // ----------------------------
    // 🔥 更新 dirContract
    // ----------------------------
    function setDirContract(address newDir) external onlyOwner {
        require(newDir != address(0), "Invalid dir");

        address old = dirContract;
        dirContract = newDir;

        emit DirContractUpdated(old, newDir);
    }

    // ----------------------------
    // Submit Article
    // ----------------------------
    function submitArticle(
        string calldata id, // 🔥 新增
        string calldata title,
        string[] calldata authors,
        bytes32[] calldata texTxIDs,
        string calldata extraMetadataURI
    ) external returns (uint256) {
        require(texTxIDs.length > 0, "Empty TEX");
        require(bytes(id).length > 0, "Empty ID");
        require(
            (idToArticle[id] == 0 && articleCount == 0) ||
                keccak256(bytes(articles[idToArticle[id]].id)) != keccak256(bytes(id)),
            "ID exists"
        );

        uint256 articleId = articleCount;

        Article storage a = articles[articleId];

        // --- Metadata ---
        a.id = id;
        a.title = title;
        a.submitter = msg.sender;
        a.timestamp = block.timestamp;

        // 🔥 关键：记录当前 dir
        a.dirContract = dirContract;

        // --- Authors ---
        for (uint256 i = 0; i < authors.length; i++) {
            a.authors.push(authors[i]);
        }

        // --- TEX ---
        for (uint256 i = 0; i < texTxIDs.length; i++) {
            a.texTxIDs.push(texTxIDs[i]);
        }

        // --- Extra metadata ---
        a.extraMetadataURI = extraMetadataURI;

        // 🔥 建立索引
        idToArticle[id] = articleId;

        articleCount++;

        emit ArticleSubmitted(articleId, id, msg.sender, title);

        return articleId;
    }

    // ----------------------------
    // View by index
    // ----------------------------
    function getArticle(
        uint256 articleId
    )
        external
        view
        returns (
            string memory id,
            string memory title,
            string[] memory authors,
            bytes32[] memory texTxIDs,
            string memory extraMetadataURI,
            address submitter,
            uint256 timestamp,
            address articleDir
        )
    {
        Article storage a = articles[articleId];

        return (
            a.id,
            a.title,
            a.authors,
            a.texTxIDs,
            a.extraMetadataURI,
            a.submitter,
            a.timestamp,
            a.dirContract
        );
    }

    // ----------------------------
    // 🔥 View by string id
    // ----------------------------
    function getArticleById(
        string calldata id
    )
        external
        view
        returns (
            string memory title,
            string[] memory authors,
            bytes32[] memory texTxIDs,
            string memory extraMetadataURI,
            address submitter,
            uint256 timestamp,
            address articleDir
        )
    {
        uint256 articleId = idToArticle[id];
        Article storage a = articles[articleId];

        return (
            a.title,
            a.authors,
            a.texTxIDs,
            a.extraMetadataURI,
            a.submitter,
            a.timestamp,
            a.dirContract
        );
    }

    // ----------------------------
    // View helpers
    // ----------------------------
    function gettexTxIDs(uint256 articleId) external view returns (bytes32[] memory) {
        return articles[articleId].texTxIDs;
    }

    function getExtraMetadataURI(uint256 articleId) external view returns (string memory) {
        return articles[articleId].extraMetadataURI;
    }
}
