// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract KeywordManager {

    struct Keyword {
        string name;
        address user;
        uint256 timestamp;
    }
    Keyword[] public keywords;
    address payable public owner;

    event keywordAdded(uint indexed keywordId, address indexed user);

    constructor() payable {
        owner = payable(msg.sender);
    }

    function add(string memory _name) public {
        keywords.push(Keyword(_name, msg.sender, block.timestamp));
        emit keywordAdded(keywords.length - 1, msg.sender);
    }

    function getList() public view returns (Keyword[] memory) {
        return keywords;
    }

    function get(uint _index) public view returns (Keyword memory) {
        return keywords[_index];
    }

    function getTotal() public view returns (uint) {
        return keywords.length;
    }
}
