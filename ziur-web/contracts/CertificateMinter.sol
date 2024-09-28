// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";
import "./CourseCertification.sol"; // Make sure this path is correct

contract CertificateMinter is Ownable, Nonces {
    using MessageHashUtils for bytes32;
    using ECDSA for bytes32;

    /* ============ Events ============ */
    event SignerChanged(address indexed oldSigner, address indexed newSigner);
    event CertificateMinted(address indexed to, uint256 indexed courseId);

    /* ============ State Variables ============ */
    address public signer;
    CourseCertification public courseCertification;
    uint256 public immutable _cachedChainId;

    /* ============ Constructor ============ */
    constructor(address courseCertificationAddr, address signer_) Ownable(msg.sender) {
        courseCertification = CourseCertification(courseCertificationAddr);
        signer = signer_;
        _cachedChainId = block.chainid;
    }

    /* ============ Public Functions ============ */
    function mint(
        address to,
        uint256 courseId,
        uint256 nonce,
        bytes memory signature
    ) external {
        require(courseCertification.balanceOf(to, courseId) == 0, "Certificate already minted");
        require(_useNonce(to) == nonce, "Invalid nonce");

        bytes32 messageHash = keccak256(
            abi.encodePacked(to, courseId, _cachedChainId, nonce)
        );
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        require(signer == ethSignedMessageHash.recover(signature), "Invalid signature");

        courseCertification.issueCertificate(to, courseId);
        emit CertificateMinted(to, courseId);
    }

    function recover(address oldOwner, address newOwner, uint256 courseId) external onlyOwner {
        courseCertification.recover(courseId, oldOwner, newOwner);
    }

    function setSigner(address newSigner) external onlyOwner {
        address oldSigner = signer;
        signer = newSigner;
        emit SignerChanged(oldSigner, newSigner);
    }
}