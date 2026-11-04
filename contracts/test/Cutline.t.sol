// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "forge-std/Test.sol";
import {Cutline} from "../src/Cutline.sol";

contract MaliciousRecipient {
  Cutline public cutline;
  constructor(Cutline _cutline) {
    cutline = _cutline;
  }
  receive() external payable {
    cutline.withdraw();
  }
}

contract CutlineTest is Test {
  Cutline public cutline;

  address public host = address(0x1111);
  address public alice = address(0x2222);
  address public bob = address(0x3333);
  address public charlie = address(0x4444);
  address public dave = address(0x5555);
  address public eve = address(0x6666);

  uint128 public constant ENTRY_FEE = 0.05 ether;
  uint128 public constant STEP_PRICE = 0.01 ether;

  function setUp() public {
    cutline = new Cutline();
    vm.deal(host, 100 ether);
    vm.deal(alice, 100 ether);
    vm.deal(bob, 100 ether);
    vm.deal(charlie, 100 ether);
    vm.deal(dave, 100 ether);
    vm.deal(eve, 100 ether);
  }

  function test_CreateJoinServe() public {
    vm.prank(host);
    uint256 id = cutline.create("Morning Clinic", ENTRY_FEE, STEP_PRICE);
    assertEq(id, 1);

    Cutline.Line memory l = cutline.lineOf(id);
    assertEq(l.host, host);
    assertEq(l.entryFee, ENTRY_FEE);
    assertEq(l.stepPrice, STEP_PRICE);
    assertEq(l.name, "Morning Clinic");
    assertEq(l.closed, false);

    // Alice joins
    vm.prank(alice);
    cutline.join{value: ENTRY_FEE}(id);

    (bool live, uint32 pos, uint32 ahead) = cutline.positionOf(id, alice);
    assertTrue(live);
    assertEq(pos, 1);
    assertEq(ahead, 0);

    // Host serves Alice
    vm.prank(host);
    cutline.serve(id);

    (live, pos, ahead) = cutline.positionOf(id, alice);
    assertFalse(live);
    assertEq(pos, 0);
  }

  function test_JoinPaysHostEntryFee() public {
    vm.prank(host);
    uint256 id = cutline.create("Ticket Booth", 0.1 ether, STEP_PRICE);

    vm.prank(alice);
    cutline.join{value: 0.1 ether}(id);

    assertEq(cutline.pending(host), 0.1 ether);

    vm.prank(host);
    cutline.withdraw();
    assertEq(cutline.pending(host), 0);
  }

  function test_SkipPaysEachPassedWalletTheStepPrice() public {
    vm.prank(host);
    uint256 id = cutline.create("Coffee Shop", ENTRY_FEE, STEP_PRICE);

    // 1: Alice, 2: Bob, 3: Charlie, 4: Dave
    vm.prank(alice);
    cutline.join{value: ENTRY_FEE}(id);
    vm.prank(bob);
    cutline.join{value: ENTRY_FEE}(id);
    vm.prank(charlie);
    cutline.join{value: ENTRY_FEE}(id);
    vm.prank(dave);
    cutline.join{value: ENTRY_FEE}(id);

    // Dave is in position 4. Skips 2 places (passes Charlie and Bob)
    vm.prank(dave);
    cutline.skip{value: 2 * STEP_PRICE}(id, 2);

    // Dave should now be at position 2
    (, uint32 davePos,) = cutline.positionOf(id, dave);
    assertEq(davePos, 2);

    // Bob and Charlie each passed once -> each got STEP_PRICE
    assertEq(cutline.pending(bob), STEP_PRICE);
    assertEq(cutline.pending(charlie), STEP_PRICE);
    assertEq(cutline.pending(alice), 0);

    // Queue order should be: Alice (1), Dave (2), Bob (3), Charlie (4)
    address[] memory slice = cutline.queueSlice(id, 0, 4);
    assertEq(slice[0], alice);
    assertEq(slice[1], dave);
    assertEq(slice[2], bob);
    assertEq(slice[3], charlie);
  }

  function test_SkipOnePlace() public {
    vm.prank(host);
    uint256 id = cutline.create("Demo Line", 0, STEP_PRICE);

    vm.prank(alice);
    cutline.join(id);
    vm.prank(bob);
    cutline.join(id);

    vm.prank(bob);
    cutline.skip{value: STEP_PRICE}(id, 1);

    (, uint32 bobPos,) = cutline.positionOf(id, bob);
    (, uint32 alicePos,) = cutline.positionOf(id, alice);
    assertEq(bobPos, 1);
    assertEq(alicePos, 2);
    assertEq(cutline.pending(alice), STEP_PRICE);
  }

  function test_SkipTenPlaces() public {
    vm.prank(host);
    uint256 id = cutline.create("Long Line", 0, STEP_PRICE);

    address[] memory people = new address[](11);
    for (uint160 i = 0; i < 11; i++) {
      people[i] = address(0x8000 + i);
      vm.deal(people[i], 1 ether);
      vm.prank(people[i]);
      cutline.join(id);
    }

    // Person at position 11 skips 10 places to position 1
    address skipper = people[10];
    vm.prank(skipper);
    cutline.skip{value: 10 * STEP_PRICE}(id, 10);

    (, uint32 pos,) = cutline.positionOf(id, skipper);
    assertEq(pos, 1);

    for (uint256 i = 0; i < 10; i++) {
      assertEq(cutline.pending(people[i]), STEP_PRICE);
    }
  }

  function test_SkipMoreThanAvailableReverts_ArgsMax() public {
    vm.prank(host);
    uint256 id = cutline.create("Line", 0, STEP_PRICE);

    vm.prank(alice);
    cutline.join(id);
    vm.prank(bob);
    cutline.join(id);

    // Bob is at position 2, maxSteps is 1. Trying to skip 2 places must revert NotThatFar(1)
    vm.prank(bob);
    vm.expectRevert(abi.encodeWithSelector(Cutline.NotThatFar.selector, 1));
    cutline.skip{value: 2 * STEP_PRICE}(id, 2);
  }

  function test_SkipZeroOrElevenReverts() public {
    vm.prank(host);
    uint256 id = cutline.create("Line", 0, STEP_PRICE);

    vm.prank(alice);
    cutline.join(id);
    vm.prank(bob);
    cutline.join(id);

    vm.startPrank(bob);
    vm.expectRevert(abi.encodeWithSelector(Cutline.BadSteps.selector, 10));
    cutline.skip(id, 0);

    vm.expectRevert(abi.encodeWithSelector(Cutline.BadSteps.selector, 10));
    cutline.skip(id, 11);
    vm.stopPrank();
  }

  function test_WrongPaymentReverts_ArgsExpected() public {
    vm.prank(host);
    uint256 id = cutline.create("Line", ENTRY_FEE, STEP_PRICE);

    // Join with wrong fee
    vm.prank(alice);
    vm.expectRevert(abi.encodeWithSelector(Cutline.WrongPayment.selector, ENTRY_FEE));
    cutline.join{value: ENTRY_FEE - 1}(id);

    vm.prank(alice);
    cutline.join{value: ENTRY_FEE}(id);

    vm.prank(bob);
    cutline.join{value: ENTRY_FEE}(id);

    // Skip with wrong step payment
    vm.prank(bob);
    vm.expectRevert(abi.encodeWithSelector(Cutline.WrongPayment.selector, STEP_PRICE));
    cutline.skip{value: STEP_PRICE + 1}(id, 1);
  }

  function test_HostCannotJoin() public {
    vm.prank(host);
    uint256 id = cutline.create("Line", 0, STEP_PRICE);

    vm.prank(host);
    vm.expectRevert(Cutline.HostCannotJoin.selector);
    cutline.join(id);
  }

  function test_CannotJoinTwice_ArgsPosition() public {
    vm.prank(host);
    uint256 id = cutline.create("Line", 0, STEP_PRICE);

    vm.prank(alice);
    cutline.join(id);

    vm.prank(alice);
    vm.expectRevert(abi.encodeWithSelector(Cutline.AlreadyInLine.selector, 1));
    cutline.join(id);
  }

  function test_ServeRemovesFront_AndAllowsRejoin() public {
    vm.prank(host);
    uint256 id = cutline.create("Line", 0, STEP_PRICE);

    vm.prank(alice);
    cutline.join(id);
    vm.prank(bob);
    cutline.join(id);

    vm.prank(host);
    cutline.serve(id); // serves Alice

    // Alice is out
    (bool live,,) = cutline.positionOf(id, alice);
    assertFalse(live);

    // Bob is now position 1
    (, uint32 bobPos,) = cutline.positionOf(id, bob);
    assertEq(bobPos, 1);

    // Alice can rejoin at the back (position 2)
    vm.prank(alice);
    cutline.join(id);

    uint32 alicePos;
    (live, alicePos,) = cutline.positionOf(id, alice);
    assertTrue(live);
    assertEq(alicePos, 2);
  }

  function test_ClosedLineRejectsJoinButAllowsSkipAndServe() public {
    vm.prank(host);
    uint256 id = cutline.create("Line", 0, STEP_PRICE);

    vm.prank(alice);
    cutline.join(id);
    vm.prank(bob);
    cutline.join(id);

    vm.prank(host);
    cutline.close(id);

    // Joining closed line reverts
    vm.prank(charlie);
    vm.expectRevert(Cutline.LineClosed.selector);
    cutline.join(id);

    // Skipping allowed on closed line
    vm.prank(bob);
    cutline.skip{value: STEP_PRICE}(id, 1);
    (, uint32 bobPos,) = cutline.positionOf(id, bob);
    assertEq(bobPos, 1);

    // Serving allowed on closed line
    vm.prank(host);
    cutline.serve(id); // serves Bob
    (bool live,,) = cutline.positionOf(id, bob);
    assertFalse(live);
  }

  function test_QueueFullAtLimit() public {
    vm.prank(host);
    uint256 id = cutline.create("Limit Line", 0, STEP_PRICE);

    for (uint160 i = 0; i < 500; i++) {
      address p = address(0x9000 + i);
      vm.prank(p);
      cutline.join(id);
    }

    address overflowUser = address(0x9999);
    vm.prank(overflowUser);
    vm.expectRevert(Cutline.QueueFull.selector);
    cutline.join(id);
  }

  function test_ReentrantWithdrawBlocked() public {
    MaliciousRecipient mal = new MaliciousRecipient(cutline);
    vm.deal(address(mal), 1 ether);

    vm.prank(host);
    uint256 id = cutline.create("Reentrancy Line", 0, STEP_PRICE);

    vm.prank(address(mal));
    cutline.join(id);

    vm.prank(alice);
    cutline.join(id);

    // Alice skips mal, crediting mal with STEP_PRICE
    vm.prank(alice);
    cutline.skip{value: STEP_PRICE}(id, 1);

    // mal attempts reentrant withdraw
    vm.prank(address(mal));
    vm.expectRevert(Cutline.TransferFailed.selector);
    cutline.withdraw();
  }

  function test_NameValidation() public {
    vm.startPrank(host);
    vm.expectRevert(Cutline.EmptyName.selector);
    cutline.create("", 0, STEP_PRICE);

    bytes memory tooLong = new bytes(49);
    vm.expectRevert(abi.encodeWithSelector(Cutline.NameTooLong.selector, 49, 48));
    cutline.create(string(tooLong), 0, STEP_PRICE);

    vm.expectRevert(Cutline.ZeroStep.selector);
    cutline.create("Valid", 0, 0);
    vm.stopPrank();
  }

  function test_ViewsAndPagination() public {
    vm.prank(host);
    uint256 id = cutline.create("View Line", ENTRY_FEE, STEP_PRICE);

    vm.prank(alice);
    cutline.join{value: ENTRY_FEE}(id);
    vm.prank(bob);
    cutline.join{value: ENTRY_FEE}(id);
    vm.prank(charlie);
    cutline.join{value: ENTRY_FEE}(id);

    assertEq(cutline.quoteSkip(id, 2), 2 * STEP_PRICE);

    address[] memory slice = cutline.queueSlice(id, 1, 2);
    assertEq(slice.length, 2);
    assertEq(slice[0], bob);
    assertEq(slice[1], charlie);

    (uint256[] memory ids, Cutline.Line[] memory lines, uint256 total) = cutline.latest(0, 10);
    assertEq(total, 1);
    assertEq(ids.length, 1);
    assertEq(ids[0], 1);
    assertEq(lines[0].name, "View Line");
  }

  function testFuzz_SkipPreservesMembership(uint8 countRaw, uint8 skipStepsRaw) public {
    uint8 count = uint8(bound(countRaw, 3, 15));
    uint8 steps = uint8(bound(skipStepsRaw, 1, count - 1));
    if (steps > 10) steps = 10;

    vm.prank(host);
    uint256 id = cutline.create("Fuzz Line", 0, STEP_PRICE);

    address[] memory users = new address[](count);
    for (uint160 i = 0; i < count; i++) {
      users[i] = address(0xA000 + i);
      vm.deal(users[i], 1 ether);
      vm.prank(users[i]);
      cutline.join(id);
    }

    // Person at position `steps + 1` skips `steps`
    address skipper = users[steps];
    vm.prank(skipper);
    cutline.skip{value: uint256(steps) * STEP_PRICE}(id, steps);

    // Skipper is now at pos 1
    (, uint32 newPos,) = cutline.positionOf(id, skipper);
    assertEq(newPos, 1);

    // Check all users are still live and in the queue
    for (uint256 i = 0; i < count; i++) {
      (bool live, uint32 p,) = cutline.positionOf(id, users[i]);
      assertTrue(live);
      assertTrue(p >= 1 && p <= count);
    }
  }

  function testFuzz_Conservation(uint8 nJoinsRaw, uint8 nSkipsRaw) public {
    uint8 nJoins = uint8(bound(nJoinsRaw, 2, 8));
    uint8 nSkips = uint8(bound(nSkipsRaw, 1, 5));

    vm.prank(host);
    uint256 id = cutline.create("Fuzz Conserve", ENTRY_FEE, STEP_PRICE);

    for (uint160 i = 0; i < nJoins; i++) {
      address u = address(0xB000 + i);
      vm.deal(u, 1 ether);
      vm.prank(u);
      cutline.join{value: ENTRY_FEE}(id);
    }

    uint256 totalPaidIn = uint256(nJoins) * ENTRY_FEE;

    for (uint8 s = 0; s < nSkips; s++) {
      // Last person skips 1 place
      address u = address(uint160(0xB000 + (nJoins - 1)));
      (, uint32 pos,) = cutline.positionOf(id, u);
      if (pos > 1) {
        vm.prank(u);
        cutline.skip{value: STEP_PRICE}(id, 1);
        totalPaidIn += STEP_PRICE;
      }
    }

    uint256 sumPending = cutline.pending(host);
    for (uint160 i = 0; i < nJoins; i++) {
      sumPending += cutline.pending(address(0xB000 + i));
    }

    assertEq(address(cutline).balance, totalPaidIn);
    assertEq(address(cutline).balance, sumPending);
  }
}
