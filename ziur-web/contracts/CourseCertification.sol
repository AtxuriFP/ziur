// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

interface IERC5192 {
    event LockingStatusChanged(uint256 indexed tokenId, bool status);
    function locked(uint256 tokenId) external view returns (bool);
}

contract CourseCertification is ERC1155Supply, Ownable, Pausable, IERC5192 {
    using Strings for uint256;
    using Counters for Counters.Counter;

    struct Course {
        string name;
        string description;
        string trainerName;
        string organization;
        uint256 startDate;
        uint256 endDate;
        uint256 durationInHours;
        bool active;
        string courseURI;
    }

    // State variables
    Counters.Counter private _courseIdCounter;
    mapping(uint256 => Course) public courses;
    mapping(uint256 => mapping(address => bool)) private _certificateHolders;
    mapping(address => bool) public minters;
    mapping(uint256 => bool) private _lockStatus;
    
    string public name;
    string public symbol;
    string private _baseURI;

    // Events
    event CourseCreated(
        uint256 indexed courseId,
        string name,
        string trainerName,
        string organization,
        uint256 startDate,
        uint256 endDate,
        uint256 durationInHours,
        string courseURI
    );

    event CourseUpdated(
        uint256 indexed courseId,
        string name,
        string trainerName,
        string organization,
        uint256 startDate,
        uint256 endDate,
        uint256 durationInHours,
        bool active,
        string courseURI
    );

    event CertificateIssued(uint256 indexed courseId, address indexed student);
    event CertificateRecovered(
        uint256 indexed courseId, 
        address indexed from, 
        address indexed to,
        string reason
    );
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    // Modifiers
    modifier onlyMinter() {
        require(minters[_msgSender()] || owner() == _msgSender(), "Not authorized to mint");
        _;
    }

    // Constructor
    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_
    ) ERC1155(baseURI_) Ownable(msg.sender) {
        name = name_;
        symbol = symbol_;
        _baseURI = baseURI_;
    }

    // Course Management Functions
    function createCourse(
        string memory courseName,
        string memory description,
        string memory trainerName,
        string memory organization,
        uint256 startDate,
        uint256 endDate,
        uint256 durationInHours,
        string memory courseURI
    ) public onlyOwner {
        uint256 newCourseId = _courseIdCounter.current();
        _courseIdCounter.increment();
        
        courses[newCourseId] = Course({
            name: courseName,
            description: description,
            trainerName: trainerName,
            organization: organization,
            startDate: startDate,
            endDate: endDate,
            durationInHours: durationInHours,
            active: true,
            courseURI: courseURI
        });
        
        emit CourseCreated(
            newCourseId,
            courseName,
            trainerName,
            organization,
            startDate,
            endDate,
            durationInHours,
            courseURI
        );
    }

    function updateCourse(
        uint256 courseId,
        string memory courseName,
        string memory description,
        string memory trainerName,
        string memory organization,
        uint256 startDate,
        uint256 endDate,
        uint256 durationInHours,
        bool active,
        string memory courseURI
    ) public onlyOwner {
        require(courseId < _courseIdCounter.current(), "Invalid course ID");
        
        Course storage course = courses[courseId];
        course.name = courseName;
        course.description = description;
        course.trainerName = trainerName;
        course.organization = organization;
        course.startDate = startDate;
        course.endDate = endDate;
        course.durationInHours = durationInHours;
        course.active = active;
        course.courseURI = courseURI;

        emit CourseUpdated(
            courseId,
            courseName,
            trainerName,
            organization,
            startDate,
            endDate,
            durationInHours,
            active,
            courseURI
        );
    }

    // Certificate Management Functions
    function issueCertificate(address student, uint256 courseId) public onlyMinter {
        require(courses[courseId].active, "Course is not active");
        require(!_certificateHolders[courseId][student], "Certificate already issued");
        require(student != address(0), "Invalid recipient");

        _mint(student, courseId, 1, "");
        emit CertificateIssued(courseId, student);
    }

    function adminRecoverCertificate(
        uint256 courseId,
        address from,
        address to,
        string calldata reason
    ) public onlyOwner {
        require(_certificateHolders[courseId][from], "No certificate found");
        require(to != address(0), "Invalid new address");
        require(to != from, "Same address");
        require(!_certificateHolders[courseId][to], "Destination already has certificate");
        require(bytes(reason).length > 0, "Reason required");

        _certificateHolders[courseId][from] = false;
        _certificateHolders[courseId][to] = true;

        uint256[] memory ids = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        ids[0] = courseId;
        amounts[0] = 1;
        
        _update(from, to, ids, amounts);

        emit CertificateRecovered(courseId, from, to, reason);
    }

    // Minter Management
    function addMinter(address minter) public onlyOwner {
        require(minter != address(0), "Invalid minter address");
        minters[minter] = true;
        emit MinterAdded(minter);
    }

    function removeMinter(address minter) public onlyOwner {
        minters[minter] = false;
        emit MinterRemoved(minter);
    }

    // URI Management
    function uri(uint256 tokenId) public view virtual override returns (string memory) {
        require(exists(tokenId), "URI query for nonexistent token");
        string memory courseURI = courses[tokenId].courseURI;
        
        // If course URI is empty, fall back to base URI + tokenId
        if (bytes(courseURI).length == 0) {
            return string(abi.encodePacked(_baseURI, tokenId.toString()));
        }
        
        return courseURI;
    }

    // View Functions
    function getCourseDetails(uint256 courseId) public view returns (Course memory) {
        require(courseId < _courseIdCounter.current(), "Invalid course ID");
        return courses[courseId];
    }

    // Transfer Prevention
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 value,
        bytes memory data
    ) public virtual override {
        require(
            owner() == _msgSender() && from != address(0),
            "Only admin can transfer existing tokens"
        );
        super.safeTransferFrom(from, to, id, value, data);
    }

    function safeBatchTransferFrom(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public virtual override {
        revert("Batch transfers not supported");
    }

    function setApprovalForAll(address, bool) public virtual override {
        revert("Approvals not supported");
    }

    function isApprovedForAll(address, address) public view virtual override returns (bool) {
        return false;
    }

    // ERC5192 Implementation
    function locked(uint256 tokenId) external view override returns (bool) {
        require(exists(tokenId), "Token does not exist");
        return _lockStatus[tokenId];
    }

    // Internal Functions
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal virtual override whenNotPaused {
        require(ids.length == values.length, "Length mismatch");
        
        // Handle different cases
        if (from == address(0)) {
            // Minting case
            require(
                minters[_msgSender()] || owner() == _msgSender(),
                "Not authorized to mint"
            );
            for (uint256 i = 0; i < ids.length; i++) {
                require(values[i] == 1, "Can only mint one certificate per ID");
                _lockStatus[ids[i]] = true;
                _certificateHolders[ids[i]][to] = true;
                emit LockingStatusChanged(ids[i], true);
            }
        } else if (to == address(0)) {
            // Burning case - only owner can burn
            require(owner() == _msgSender(), "Only admin can burn");
            for (uint256 i = 0; i < ids.length; i++) {
                _lockStatus[ids[i]] = false;
                _certificateHolders[ids[i]][from] = false;
                emit LockingStatusChanged(ids[i], false);
            }
        } else {
            // Transfer case - only owner can transfer for recovery
            require(owner() == _msgSender(), "Transfer restricted to admin");
            for (uint256 i = 0; i < ids.length; i++) {
                require(
                    _certificateHolders[ids[i]][from],
                    "Source must own certificate"
                );
                require(
                    !_certificateHolders[ids[i]][to],
                    "Destination already has certificate"
                );
                _certificateHolders[ids[i]][from] = false;
                _certificateHolders[ids[i]][to] = true;
            }
        }

        super._update(from, to, ids, values);
    }

    // Pause Functionality
    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}