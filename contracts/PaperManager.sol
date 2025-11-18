// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PaperManager {
    struct PaperAuthor {
        uint256 authorId;
        bool isFirstAuthor;
        bool isCorrespondingAuthor;
    }

    // 论文结构体
    struct Paper {
        uint256 id;
        string title;
        string abstractText;
        string[] sections;
        address creator;
        PaperAuthor[] authors;
        uint256[] keywordIds;
        uint256 createdAt;
    }

    // 状态变量
    mapping(uint256 => Paper) public papers;
    uint256 public nextPaperId;
    address public owner;

    // 事件
    event PaperCreated(
        uint256 indexed paperId,
        string title,
        address indexed author,
        uint256 createdAt
    );

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // 构造函数 - 设置部署者为owner
    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // 修饰器 - 只有owner可以调用
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    // 创建新论文 - 只有owner可以调用（需要Gas）
    function createPaper(
        string memory _title,
        string memory _abstract,
        string[] memory _sections,
        PaperAuthor[] memory _authors,
        uint256[] memory _keywordIds
    ) public onlyOwner returns (uint256) {
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(bytes(_abstract).length > 0, "Abstract cannot be empty");
        require(_sections.length > 0, "Must have at least one section");
        require(_authors.length > 0, "Must provide at least one author");

        uint256 paperId = nextPaperId;

        Paper storage newPaper = papers[paperId];
        newPaper.id = paperId;
        newPaper.title = _title;
        newPaper.abstractText = _abstract;
        newPaper.sections = _sections;
        newPaper.creator = msg.sender;
        newPaper.createdAt = block.timestamp;

        delete newPaper.authors;
        for (uint256 i = 0; i < _authors.length; i++) {
            newPaper.authors.push(_authors[i]);
        }

        delete newPaper.keywordIds;
        for (uint256 j = 0; j < _keywordIds.length; j++) {
            newPaper.keywordIds.push(_keywordIds[j]);
        }

        nextPaperId++;

        emit PaperCreated(paperId, _title, msg.sender, block.timestamp);
        return paperId;
    }

    // 转移所有权 - 只有当前owner可以调用
    function transferOwnership(address _newOwner) public onlyOwner {
        require(_newOwner != address(0), "New owner cannot be zero address");
        require(_newOwner != owner, "New owner must be different");

        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }

    // 放弃所有权 - 只有当前owner可以调用
    function renounceOwnership() public onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    // ========== 公开读取函数（不需要Gas） ==========

    // 通过ID获取完整论文信息 - 公开（view函数）
    function getPaper(uint256 _paperId) public view returns (Paper memory) {
        require(_paperId < nextPaperId, "Paper does not exist");
        require(papers[_paperId].id == _paperId, "Paper has been deleted");

        return papers[_paperId];
    }

    // 获取论文基本信息 - 公开（view函数）
    function getPaperBasicInfo(
        uint256 _paperId
    )
        public
        view
        returns (
            uint256 id,
            string memory title,
            string memory abstractText,
            address creator,
            uint256 createdAt
        )
    {
        require(_paperId < nextPaperId, "Paper does not exist");
        Paper memory paper = papers[_paperId];

        return (paper.id, paper.title, paper.abstractText, paper.creator, paper.createdAt);
    }

    // 获取论文的section数量 - 公开（view函数）
    function getSectionCount(uint256 _paperId) public view returns (uint256) {
        require(_paperId < nextPaperId, "Paper does not exist");
        return papers[_paperId].sections.length;
    }

    // 获取特定section内容 - 公开（view函数）
    function getSection(
        uint256 _paperId,
        uint256 _sectionIndex
    ) public view returns (string memory) {
        require(_paperId < nextPaperId, "Paper does not exist");
        require(_sectionIndex < papers[_paperId].sections.length, "Section index out of bounds");

        return papers[_paperId].sections[_sectionIndex];
    }

    function getPaperAuthors(uint256 _paperId) public view returns (PaperAuthor[] memory) {
        require(_paperId < nextPaperId, "Paper does not exist");
        return papers[_paperId].authors;
    }

    function getPaperKeywordIds(uint256 _paperId) public view returns (uint256[] memory) {
        require(_paperId < nextPaperId, "Paper does not exist");
        return papers[_paperId].keywordIds;
    }

    // 获取总论文数量 - 公开（view函数）
    function getTotalPapers() public view returns (uint256) {
        return nextPaperId;
    }

    // 检查地址是否是owner - 公开（view函数）
    function isOwner(address _address) public view returns (bool) {
        return _address == owner;
    }

    // 获取当前owner地址 - 公开（view函数）
    function getOwner() public view returns (address) {
        return owner;
    }
}
