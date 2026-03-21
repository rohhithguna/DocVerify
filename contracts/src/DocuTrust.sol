// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DocuTrust
 * @notice Blockchain-based certificate verification contract.
 *         Stores Merkle roots on-chain for tamper-proof verification.
 * @dev    Designed for simplicity. No upgradability, no proxies, no oracles.
 */
contract DocuTrust {
    // ──────────────────────────────────────────────
    //  Data Structures
    // ──────────────────────────────────────────────

    /// @notice Contract owner (deployer)
    address public owner;

    /// @notice Mapping from Merkle root -> validity
    mapping(bytes32 => bool) public validRoots;

    /// @notice Mapping from Merkle root -> revocation state
    mapping(bytes32 => bool) public revokedRoots;

    /// @notice Mapping from Merkle root -> issuer address
    mapping(bytes32 => address) public rootIssuers;

    /// @notice Mapping from Merkle root -> created timestamp
    mapping(bytes32 => uint256) public rootTimestamps;

    /// @notice Total number of roots ever issued
    uint256 public totalDocuments;

    /// @notice Tracks authorized issuers (owner can add/remove)
    mapping(address => bool) public authorizedIssuers;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event RootStored(bytes32 indexed root, address indexed issuer, uint256 timestamp);
    event RootRevoked(bytes32 indexed root, address indexed revokedBy, uint256 timestamp);
    event DocumentIssued(bytes32 indexed docHash, address indexed issuer, uint256 timestamp);
    event DocumentRevoked(bytes32 indexed docHash, address indexed revokedBy, uint256 timestamp);
    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "DocuTrust: caller is not the owner");
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == owner || authorizedIssuers[msg.sender],
            "DocuTrust: caller is not authorized"
        );
        _;
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true;
    }

    // ──────────────────────────────────────────────
    //  Core Functions
    // ──────────────────────────────────────────────

    function _storeRoot(bytes32 root, address issuer) private {
        require(root != bytes32(0), "DocuTrust: empty hash");
        require(!validRoots[root], "DocuTrust: document already issued");

        validRoots[root] = true;
        revokedRoots[root] = false;
        rootIssuers[root] = issuer;
        rootTimestamps[root] = block.timestamp;

        totalDocuments++;

        emit RootStored(root, issuer, block.timestamp);
        emit DocumentIssued(root, issuer, block.timestamp);
    }

    /**
     * @notice Register a Merkle root on the blockchain.
     * @param root The Merkle root as bytes32.
     */
    function storeRoot(bytes32 root) public onlyAuthorized {
        _storeRoot(root, msg.sender);
    }

    /**
     * @notice Check if a Merkle root exists and whether it was revoked.
     */
    function verifyRoot(bytes32 root)
        external
        view
        returns (
            bool    exists_,
            bool    revoked_,
            address issuer_,
            uint256 timestamp_
        )
    {
        return (
            validRoots[root],
            revokedRoots[root],
            rootIssuers[root],
            rootTimestamps[root]
        );
    }

    /**
     * @notice Revoke a previously stored Merkle root.
     *         Only the original issuer or the contract owner can revoke.
     */
    function revokeRoot(bytes32 root) public {
        require(validRoots[root], "DocuTrust: document does not exist");
        require(!revokedRoots[root], "DocuTrust: document already revoked");
        require(
            msg.sender == rootIssuers[root] || msg.sender == owner,
            "DocuTrust: only issuer or owner can revoke"
        );

        revokedRoots[root] = true;

        emit RootRevoked(root, msg.sender, block.timestamp);
        emit DocumentRevoked(root, msg.sender, block.timestamp);
    }

    // Backward-compatible wrappers. These now operate on roots.
    function issueDocument(bytes32 docHash) external onlyAuthorized {
        _storeRoot(docHash, msg.sender);
    }

    function verifyDocument(bytes32 docHash)
        external
        view
        returns (
            bool exists_,
            bool revoked_,
            address issuer_,
            uint256 timestamp_
        )
    {
        return (
            validRoots[docHash],
            revokedRoots[docHash],
            rootIssuers[docHash],
            rootTimestamps[docHash]
        );
    }

    function revokeDocument(bytes32 docHash) external {
        revokeRoot(docHash);
    }

    // ──────────────────────────────────────────────
    //  Admin Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Add an authorized issuer.
     */
    function addIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "DocuTrust: zero address");
        authorizedIssuers[issuer] = true;
        emit IssuerAdded(issuer);
    }

    /**
     * @notice Remove an authorized issuer.
     */
    function removeIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }
}
