// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AuthorManager {

    struct Author {
        string firstName;
        string lastName;
        string email;
        string doi;
        address user;
        uint256 timestamp;
    }
    Author[] public authors;

    struct EditAuthr {
        uint idx;
        string firstName;
        string lastName;
        string email;
        string doi;
    }
    address payable public owner;

    event authorAdded(uint indexed authorId, address indexed user);

    constructor() payable {
        owner = payable(msg.sender);
    }

    function add(string memory firstName, string memory lastName, string memory email, string memory doi) public {
        authors.push(Author(firstName, lastName, email, doi, msg.sender, block.timestamp));
        emit authorAdded(authors.length - 1, msg.sender);
    }

    function add(string memory firstName, string memory lastName, string memory email) public {
        string memory doi = '';
        add(firstName, lastName, email, doi);
    }

    function set(EditAuthr memory author) public {
        require(author.idx < authors.length, "Author index out of bounds");
        
        if (bytes(author.firstName).length > 0) {
            authors[author.idx].firstName = author.firstName;
        }
        if (bytes(author.lastName).length > 0) {
            authors[author.idx].lastName = author.lastName;
        }
        if (bytes(author.email).length > 0) {
            authors[author.idx].email = author.email;
        }
        if (bytes(author.doi).length > 0) {
            authors[author.idx].doi = author.doi;
        }
    }

    function getList() public view returns (Author[] memory) {
        return authors;
    }

    function get(uint index) public view returns (Author memory) {
        require(index < authors.length, "Author index out of bounds");
        return authors[index];
    }

    function getTotal() public view returns (uint) {
        return authors.length;
    }
}
