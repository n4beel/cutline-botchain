// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

contract Cutline {
  // --- Errors ---
  error EmptyName();
  error NameTooLong(uint256 length, uint256 max);
  error ZeroStep();
  error LineNotFound();
  error LineClosed();
  error HostCannotJoin();
  error AlreadyInLine(uint32 position);
  error QueueFull();
  error WrongPayment(uint256 expected);
  error NotInLine();
  error BadSteps(uint8 max);
  error NotThatFar(uint32 maxSteps);
  error NotHost();
  error EmptyLine();
  error NothingToWithdraw();
  error TransferFailed();
  error Reentrancy();

  // --- Constants ---
  uint256 public constant MAX_NAME_BYTES = 48;
  uint256 public constant MAX_QUEUE = 500;
  uint8 public constant MAX_SKIP = 10;
  uint256 public constant MAX_PAGE = 50;

  // --- Types ---
  // Packing: host (20) + head (4) + tail (4) + closed (1) = 29 bytes (fits 1 slot)
  // entryFee (16) + stepPrice (16) = 32 bytes (fits 1 slot)
  struct Line {
    address host;
    uint32 head;
    uint32 tail;
    bool closed;
    uint128 entryFee;
    uint128 stepPrice;
    string name;
  }

  // --- Storage ---
  mapping(uint256 => Line) private _lines;
  mapping(uint256 => address[]) private _order;                 // positions head..tail-1 are live
  mapping(uint256 => mapping(address => uint32)) private _slot; // index + 1; live only while slot-1 >= head
  mapping(address => uint256) public pending;
  uint256 public lineCount;                                     // ids start at 1

  bool private _locked;

  // --- Events ---
  event Created(uint256 indexed id, address indexed host, string name, uint128 entryFee, uint128 stepPrice);
  event Joined(uint256 indexed id, address indexed who, uint32 position);
  event Skipped(uint256 indexed id, address indexed who, uint32 fromPosition, uint32 toPosition, uint256 paid);
  event Served(uint256 indexed id, address indexed who);
  event Closed(uint256 indexed id);
  event Withdrawn(address indexed to, uint256 amount);

  // --- Modifiers ---
  modifier nonReentrant() {
    if (_locked) revert Reentrancy();
    _locked = true;
    _;
    _locked = false;
  }

  // --- External Mutating Functions ---

  /// @notice Create a new cutline queue
  function create(string calldata name, uint128 entryFee, uint128 stepPrice) external returns (uint256 id) {
    bytes memory nameBytes = bytes(name);
    if (nameBytes.length == 0) revert EmptyName();
    if (nameBytes.length > MAX_NAME_BYTES) revert NameTooLong(nameBytes.length, MAX_NAME_BYTES);
    if (stepPrice == 0) revert ZeroStep();

    id = ++lineCount;
    Line storage l = _lines[id];
    l.host = msg.sender;
    l.head = 0;
    l.tail = 0;
    l.closed = false;
    l.entryFee = entryFee;
    l.stepPrice = stepPrice;
    l.name = name;

    emit Created(id, msg.sender, name, entryFee, stepPrice);
  }

  /// @notice Join the back of a line
  function join(uint256 id) external payable {
    if (id == 0 || id > lineCount) revert LineNotFound();
    Line storage l = _lines[id];
    if (l.closed) revert LineClosed();
    if (msg.sender == l.host) revert HostCannotJoin();

    uint32 rawSlot = _slot[id][msg.sender];
    if (rawSlot != 0) {
      uint32 idx = rawSlot - 1;
      if (idx >= l.head && idx < l.tail) {
        uint32 currentPos = (idx - l.head) + 1;
        revert AlreadyInLine(currentPos);
      }
    }

    uint32 liveCount = l.tail - l.head;
    if (liveCount >= MAX_QUEUE) revert QueueFull();
    if (msg.value != l.entryFee) revert WrongPayment(l.entryFee);

    pending[l.host] += msg.value;

    uint32 newIdx = l.tail++;
    _order[id].push(msg.sender);
    _slot[id][msg.sender] = newIdx + 1;

    uint32 position = liveCount + 1;
    emit Joined(id, msg.sender, position);
  }

  /// @notice Skip forward up to MAX_SKIP places
  function skip(uint256 id, uint8 steps) external payable {
    if (id == 0 || id > lineCount) revert LineNotFound();
    Line storage l = _lines[id];

    uint32 rawSlot = _slot[id][msg.sender];
    if (rawSlot == 0) revert NotInLine();
    uint32 currentIdx = rawSlot - 1;
    if (currentIdx < l.head || currentIdx >= l.tail) revert NotInLine();

    uint32 fromPosition = (currentIdx - l.head) + 1;
    if (steps == 0 || steps > MAX_SKIP) revert BadSteps(MAX_SKIP);
    if (steps > fromPosition - 1) revert NotThatFar(fromPosition - 1);

    uint256 expectedPayment = uint256(steps) * uint256(l.stepPrice);
    if (msg.value != expectedPayment) revert WrongPayment(expectedPayment);

    // Shift the `steps` people ahead backward by 1
    // The people ahead are from currentIdx - steps to currentIdx - 1
    uint32 targetIdx = currentIdx - steps;
    address[] storage orderArr = _order[id];

    for (uint32 i = currentIdx; i > targetIdx; i--) {
      address passedPerson = orderArr[i - 1];
      orderArr[i] = passedPerson;
      _slot[id][passedPerson] = i + 1;
      pending[passedPerson] += l.stepPrice;
    }

    orderArr[targetIdx] = msg.sender;
    _slot[id][msg.sender] = targetIdx + 1;

    uint32 toPosition = (targetIdx - l.head) + 1;
    emit Skipped(id, msg.sender, fromPosition, toPosition, msg.value);
  }

  /// @notice Serve the next person in line
  function serve(uint256 id) external {
    if (id == 0 || id > lineCount) revert LineNotFound();
    Line storage l = _lines[id];
    if (msg.sender != l.host) revert NotHost();
    if (l.head >= l.tail) revert EmptyLine();

    address servedPerson = _order[id][l.head];
    l.head++;

    emit Served(id, servedPerson);
  }

  /// @notice Close the line to further joins
  function close(uint256 id) external {
    if (id == 0 || id > lineCount) revert LineNotFound();
    Line storage l = _lines[id];
    if (msg.sender != l.host) revert NotHost();

    l.closed = true;
    emit Closed(id);
  }

  /// @notice Pull accrued pending earnings
  function withdraw() external nonReentrant {
    uint256 amount = pending[msg.sender];
    if (amount == 0) revert NothingToWithdraw();

    pending[msg.sender] = 0;

    (bool ok,) = msg.sender.call{value: amount}("");
    if (!ok) revert TransferFailed();

    emit Withdrawn(msg.sender, amount);
  }

  // --- View Functions ---

  /// @notice Get line information
  function lineOf(uint256 id) external view returns (Line memory) {
    if (id == 0 || id > lineCount) revert LineNotFound();
    return _lines[id];
  }

  /// @notice Get caller or target address position in line
  function positionOf(uint256 id, address who)
    external
    view
    returns (bool live, uint32 position, uint32 ahead)
  {
    if (id == 0 || id > lineCount) revert LineNotFound();
    Line storage l = _lines[id];

    uint32 rawSlot = _slot[id][who];
    if (rawSlot == 0) {
      return (false, 0, 0);
    }

    uint32 idx = rawSlot - 1;
    if (idx < l.head || idx >= l.tail) {
      return (false, 0, 0);
    }

    ahead = idx - l.head;
    position = ahead + 1;
    live = true;
  }

  /// @notice Calculate cost to skip given number of steps
  function quoteSkip(uint256 id, uint8 steps) external view returns (uint256) {
    if (id == 0 || id > lineCount) revert LineNotFound();
    return uint256(steps) * uint256(_lines[id].stepPrice);
  }

  /// @notice Retrieve a slice of live queue addresses starting from front
  function queueSlice(uint256 id, uint32 start, uint32 count)
    external
    view
    returns (address[] memory)
  {
    if (id == 0 || id > lineCount) revert LineNotFound();
    Line storage l = _lines[id];

    uint32 totalLive = l.tail - l.head;
    if (start >= totalLive || count == 0) {
      return new address[](0);
    }

    if (count > MAX_PAGE) {
      count = uint32(MAX_PAGE);
    }

    if (start + count > totalLive) {
      count = totalLive - start;
    }

    address[] memory slice = new address[](count);
    address[] storage orderArr = _order[id];
    uint32 base = l.head + start;

    for (uint32 i = 0; i < count; i++) {
      slice[i] = orderArr[base + i];
    }

    return slice;
  }

  /// @notice Retrieve latest lines
  function latest(uint256 offset, uint256 count)
    external
    view
    returns (uint256[] memory ids, Line[] memory lines, uint256 total)
  {
    total = lineCount;
    if (count > MAX_PAGE) {
      count = MAX_PAGE;
    }

    if (offset >= total || count == 0) {
      return (new uint256[](0), new Line[](0), total);
    }

    if (offset + count > total) {
      count = total - offset;
    }

    ids = new uint256[](count);
    lines = new Line[](count);

    for (uint256 i = 0; i < count; i++) {
      uint256 id = total - (offset + i);
      ids[i] = id;
      lines[i] = _lines[id];
    }
  }
}
