// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract CourseCertification is ERC1155Supply, Ownable, Pausable {
uint256 private _courseIdCounter;

struct Course {
    string name;
    string description;
    string trainerName;
    uint256 startDate;
    uint256 endDate;
    uint256 durationInHours;
    bool active;
}

mapping(uint256 => Course) public courses;
mapping(uint256 => mapping(address => bool)) private _soulboundTokens;
mapping(address => bool) public minters;

string public name;
string public symbol;
string private _baseURI;

event CourseCreated(
    uint256 indexed courseId,
    string courseName,
    string trainerName,
    uint256 startDate,
    uint256 endDate,
    uint256 durationInHours
);
event CertificateIssued(uint256 indexed courseId, address indexed student);
event CourseUpdated(
    uint256 indexed courseId,
    string courseName,
    string trainerName,
    uint256 startDate,
    uint256 endDate,
    uint256 durationInHours,
    bool active
);
event CertificateRecovered(uint256 indexed courseId, address indexed from, address indexed to);
event MinterAdded(address indexed minter);
event MinterRemoved(address indexed minter);

modifier onlyMinter() {
    require(minters[_msgSender()] || owner() == _msgSender(), "Not authorized to mint");
    _;
}

constructor(string memory name_, string memory symbol_, string memory baseURI_) 
    ERC1155(baseURI_) 
    Ownable(msg.sender)
{
    name = name_;
    symbol = symbol_;
    _baseURI = baseURI_;
}

function setBaseURI(string memory newBaseURI) public onlyOwner {
    _baseURI = newBaseURI;
}

function uri(uint256 tokenId) public view virtual override returns (string memory) {
    return string(abi.encodePacked(_baseURI, Strings.toString(tokenId)));
}

function createCourse(
    string memory courseName,
    string memory description,
    string memory trainerName,
    uint256 startDate,
    uint256 endDate,
    uint256 durationInHours
) public onlyOwner {
    uint256 newCourseId = _courseIdCounter;
    _courseIdCounter += 1;
    
    courses[newCourseId] = Course(
        courseName,
        description,
        trainerName,
        startDate,
        endDate,
        durationInHours,
        true
    );
    
    emit CourseCreated(newCourseId, courseName, trainerName, startDate, endDate, durationInHours);
}

function updateCourse(
    uint256 courseId,
    string memory courseName,
    string memory description,
    string memory trainerName,
    uint256 startDate,
    uint256 endDate,
    uint256 durationInHours,
    bool active
) public onlyOwner {
    require(courseId < _courseIdCounter, "Invalid course ID");
    
    Course storage course = courses[courseId];
    course.name = courseName;
    course.description = description;
    course.trainerName = trainerName;
    course.startDate = startDate;
    course.endDate = endDate;
    course.durationInHours = durationInHours;
    course.active = active;

    emit CourseUpdated(courseId, courseName, trainerName, startDate, endDate, durationInHours, active);
}

function getCourseDetails(uint256 courseId) public view returns (Course memory) {
    require(courseId < _courseIdCounter, "Invalid course ID");
    return courses[courseId];
}

function issueCertificate(address student, uint256 courseId) public onlyMinter {
    require(courses[courseId].active, "Course is not active");
    require(!_soulboundTokens[courseId][student], "Certificate already issued");

    _mint(student, courseId, 1, "");
    _soulboundTokens[courseId][student] = true;

    emit CertificateIssued(courseId, student);
}

function recover(uint256 courseId, address from, address to) public {
    require(_soulboundTokens[courseId][from], "No certificate to recover");
    require(from == _msgSender() || owner() == _msgSender(), "Not authorized");

    _soulboundTokens[courseId][from] = false;
    _soulboundTokens[courseId][to] = true;

    _safeTransferFrom(from, to, courseId, 1, "");

    emit CertificateRecovered(courseId, from, to);
}

function addMinter(address minter) public onlyOwner {
    minters[minter] = true;
    emit MinterAdded(minter);
}

function removeMinter(address minter) public onlyOwner {
    minters[minter] = false;
    emit MinterRemoved(minter);
}

function pause() public onlyOwner {
    _pause();
}

function unpause() public onlyOwner {
    _unpause();
}

function _update(
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory values
) internal virtual override whenNotPaused {
    super._update(from, to, ids, values);

    if (from != address(0) && to != address(0)) {
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            require(values[i] == 1, "Can only transfer 1 certificate at a time");
            require(_soulboundTokens[id][from], "Token is soulbound");
            _soulboundTokens[id][from] = false;
            _soulboundTokens[id][to] = true;
        }
    }
}

function safeTransferFrom(
    address from,
    address to,
    uint256 id,
    uint256 amount,
    bytes memory data
) public virtual override {
    super.safeTransferFrom(from, to, id, amount, data);
}

function safeBatchTransferFrom(
    address /*from*/,
    address /*to*/,
    uint256[] memory /*ids*/,
    uint256[] memory /*amounts*/,
    bytes memory /*data*/
) public virtual override {
    revert("Batch transfers are not supported for soulbound tokens");
}
}