# Cutline Architectural Decisions & Mutation Analysis

## Architectural Decisions

1. **Sideways Compensation Model**
   - In Cutline, jumping ahead in a queue pays the participants who were jumped, not the line host.
   - When calling `skip(id, steps)`, the caller pays `steps * stepPrice`. The contract shifts each of the `steps` individuals ahead back by one index and directly adds `stepPrice` to their individual `pending[passedPerson]` balance.
   - This ensures the impatient pay the patient directly without house skimming, providing a self-equilibrating marketplace for queue positions.

2. **Host Integrity & Separation of Concerns**
   - The line host collects an upfront `entryFee` immediately upon participant `join(id)`.
   - The contract explicitly prohibits the host from joining their own line (`HostCannotJoin`) to prevent artificial manipulation of queue depths or self-dealing skips.
   - Disclaimers clearly inform users that onchain position guarantees order in this digital registry, but physical service is dispatched by the host calling `serve(id)`.

3. **Re-entrant Safe Pull Withdrawals**
   - All funds (entry fees and skip payments) accrue in `pending[address]`.
   - Withdrawals use zero-then-transfer pull semantics (`pending[msg.sender] = 0; msg.sender.call{value: amount}("")`) protected by `nonReentrant`.

---

## Mutation Check Survivors Analysis

From `python3 scripts/mutation-check.py cutline`, 20 of 25 mutants were killed. The 5 survivors are documented below:

1. **`Cutline.sol:248` — `if (start + count > totalLive)` vs `>= totalLive`**
   - When `start + count == totalLive`, `totalLive - start == count`.
   - If mutated to `>= totalLive`, the statement `count = totalLive - start` assigns `count = count`, which is a mathematical identity (noop). The behavior is identical, making this an equivalent mutant.

2. **`Cutline.sol:74` — `if (nameBytes.length > MAX_NAME_BYTES)` vs `>= MAX_NAME_BYTES`**
   - Tested strings were strictly smaller than or strictly larger than 48 bytes. A mutant changing `>` to `>=` rejects a string of exactly 48 bytes, which survives if no unit test submits an exact 48-byte string.

3. **`Cutline.sol:244` — `if (count > MAX_PAGE)` vs `>= MAX_PAGE`**
   - When `count == 50` (`MAX_PAGE`), `count = 50` sets `count` to the same value. The returned slice is identical, making this an equivalent mutant.

4. **`Cutline.sol:286` — `uint256 id = total - (offset + i)` vs `total + (offset + i)`**
   - In view pagination `latest(offset, count)`, this mutant changes the reverse indexing arithmetic. It survives when tests query page 0 with total 1 where `1 - 0 == 1 + 0 = 1`.

5. **`Cutline.sol:240` — `if (start >= totalLive || count == 0)` vs `start > totalLive`**
   - When `start == totalLive`, the mutant allows the loop to run with `count` clamped by `start + count > totalLive` to `totalLive - start = 0`, producing an empty array `new address[](0)`. Since both branches return an empty array, this is functionally equivalent.
