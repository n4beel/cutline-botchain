// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "forge-std/Test.sol";
import {Cutline} from "../src/Cutline.sol";

contract CutlineHandler is Test {
  Cutline public cutline;
  address public host = address(0x1111);
  address[] public actors;
  uint256 public activeId;
  uint128 public constant STEP_PRICE = 0.01 ether;
  uint128 public constant ENTRY_FEE = 0.02 ether;

  constructor(Cutline _cutline) {
    cutline = _cutline;
    vm.deal(host, 1000 ether);

    for (uint160 i = 1; i <= 20; i++) {
      address a = address(uint160(0x2000 + i));
      vm.deal(a, 1000 ether);
      actors.push(a);
    }

    vm.prank(host);
    activeId = cutline.create("Handler Line", ENTRY_FEE, STEP_PRICE);
  }

  function join(uint256 actorIdx) external {
    address actor = actors[actorIdx % actors.length];
    (bool live,,) = cutline.positionOf(activeId, actor);
    if (!live) {
      vm.prank(actor);
      try cutline.join{value: ENTRY_FEE}(activeId) {} catch {}
    }
  }

  function skip(uint256 actorIdx, uint8 stepsSeed) external {
    address actor = actors[actorIdx % actors.length];
    (bool live, uint32 pos,) = cutline.positionOf(activeId, actor);
    if (live && pos > 1) {
      uint32 maxS = pos - 1;
      if (maxS > 10) maxS = 10;
      uint8 steps = uint8((stepsSeed % maxS) + 1);
      uint256 cost = uint256(steps) * STEP_PRICE;
      vm.prank(actor);
      try cutline.skip{value: cost}(activeId, steps) {} catch {}
    }
  }

  function serve() external {
    vm.prank(host);
    try cutline.serve(activeId) {} catch {}
  }

  function withdraw(uint256 actorIdx) external {
    address actor;
    if (actorIdx % (actors.length + 1) == 0) {
      actor = host;
    } else {
      actor = actors[(actorIdx - 1) % actors.length];
    }
    if (cutline.pending(actor) > 0) {
      vm.prank(actor);
      try cutline.withdraw() {} catch {}
    }
  }

  function getActors() external view returns (address[] memory) {
    return actors;
  }
}

contract CutlineInvariantTest is Test {
  Cutline public cutline;
  CutlineHandler public handler;

  function setUp() public {
    cutline = new Cutline();
    handler = new CutlineHandler(cutline);
    targetContract(address(handler));
  }

  function invariant_BalanceEqualsPending() public view {
    address host = handler.host();
    address[] memory actors = handler.getActors();

    uint256 totalPending = cutline.pending(host);
    for (uint256 i = 0; i < actors.length; i++) {
      totalPending += cutline.pending(actors[i]);
    }

    assertEq(address(cutline).balance, totalPending);
  }

  function invariant_SlotsMatchOrder() public view {
    uint256 id = handler.activeId();
    Cutline.Line memory l = cutline.lineOf(id);
    uint32 liveCount = l.tail - l.head;

    if (liveCount > 0) {
      address[] memory slice = cutline.queueSlice(id, 0, liveCount);
      for (uint32 i = 0; i < slice.length; i++) {
        address person = slice[i];
        (bool live, uint32 pos, uint32 ahead) = cutline.positionOf(id, person);
        assertTrue(live);
        assertEq(pos, i + 1);
        assertEq(ahead, i);
      }
    }
  }
}
