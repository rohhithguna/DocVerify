// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DocuTrust
 * @notice Blockchain-based document verification contract.
 *         Stores SHA-256 document hashes on-chain for tamper-proof verification.
 * @dev    Designed for simplicity. No upgradability, no proxies, no oracles.
 */
contract DocuTrust {
    // ──────────────────────────────────────────────
    //  Data Structures
    // ──────────────────────────────────────────────

    struct Document {
        address issuer;       // wallet that issued the document
        uint256 timestamp;    // block timestamp when issued
        bool    exists;       // true if hash has been registered
        bool    revoked;      // true if document has been revoked
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @notice Contract owner (deployer)
    address public owner;

    /// @notice Mapping from document hash → Document metadata
    mapping(bytes32 => Document) public documents;

    /// @notice Total number of documents ever issued
    uint256 public totalDocuments;

    /// @notice Tracks authorized issuers (owner can add/remove)
    mapping(address => bool) public authorizedIssuers;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

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

    /**
     * @notice Register a document hash on the blockchain.
     * @param  docHash  The SHA-256 hash of the document (as bytes32).
     */
    function issueDocument(bytes32 docHash) external onlyAuthorized {
        require(docHash != bytes32(0), "DocuTrust: empty hash");
        require(!documents[docHash].exists, "DocuTrust: document already issued");

        documents[docHash] = Document({
            issuer:    msg.sender,
            timestamp: block.timestamp,
            exists:    true,
            revoked:   false
        });

        totalDocuments++;

        emit DocumentIssued(docHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Check if a document hash exists and is valid (not revoked).
     * @param  docHash  The SHA-256 hash to verify.
     * @return exists_   True if the hash was ever registered.
     * @return revoked_  True if the document was revoked.
     * @return issuer_   The address that originally issued it.
     * @return timestamp_ The block timestamp when it was issued.
     */
    function verifyDocument(bytes32 docHash)
        external
        view
        returns (
            bool    exists_,
            bool    revoked_,
            address issuer_,
            uint256 timestamp_
        )
    {
        Document storage doc = documents[docHash];
        return (doc.exists, doc.revoked, doc.issuer, doc.timestamp);
    }

    /**
     * @notice Revoke a previously issued document.
     *         Only the original issuer or the contract owner can revoke.
     * @param  docHash  The SHA-256 hash of the document to revoke.
     */
    function revokeDocument(bytes32 docHash) external {
        Document storage doc = documents[docHash];
        require(doc.exists, "DocuTrust: document does not exist");
        require(!doc.revoked, "DocuTrust: document already revoked");
        require(
            msg.sender == doc.issuer || msg.sender == owner,
            "DocuTrust: only issuer or owner can revoke"
        );

        doc.revoked = true;

        emit DocumentRevoked(docHash, msg.sender, block.timestamp);
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
