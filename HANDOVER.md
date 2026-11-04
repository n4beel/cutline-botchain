# Cutline Handover Document

**Project**: 56 — Cutline (`cutline-botchain`)  
**Archetype**: AO — Switchback (`#FF8A1F` ground, `#1B0E00` ink, `#111111` accent)  
**Contract**: `contracts/src/Cutline.sol`  
**Deploy Script**: `contracts/script/Deploy.s.sol`

---

## 1. Milestones Completed

- **Milestone 1 (Scaffold)**:
  - Repository scaffolded with `new-project.sh`. Dependencies installed and Next.js / Foundry toolchains set up.
- **Milestone 2 (Contract & Invariants)**:
  - `Cutline.sol` with `create`, `join`, `skip`, `serve`, `close`, `withdraw`, and rich views (`lineOf`, `positionOf`, `quoteSkip`, `queueSlice`, `latest`).
  - 18 unit & fuzz tests + 2 invariant suites (`invariant_BalanceEqualsPending`, `invariant_SlotsMatchOrder`) running 256 runs and 32,768 calls with 0 reverts.
- **Milestone 3 (ABI & Library)**:
  - Typed ABI (`lib/botchain/abi.ts` with 40 entries) and utilities in `lib/cutline.ts`, `lib/errors.ts`.
  - Comprehensive unit test suites passing in `lib/__tests__/`.
- **Milestone 4 (Integration & Local Stack)**:
  - Integration suite `test/integration/cutline.test.ts` running against Anvil on port `8656`.
  - Standalone seeding script `scripts/local-stack.mjs` serving local dev chain on port `8756`.
- **Milestone 5 (Design System & Shell)**:
  - Theme styling in `app/globals.css`, `app/layout.tsx`, `components/layout/PageShell.tsx`, `components/ui/Button.tsx`, and `components/ui/Panel.tsx`.
  - Fonts configured: Space Grotesk and IBM Plex Mono.
- **Milestone 6 (Screens & User Workflows)**:
  - Implemented `/` (Explore queues as ticket slips with live/closed filters and limits disclaimer), `/new` (Host a queue), `/line/[id]` (Switchback serpentine visualization, skip slider preview, join button, host console), `/me` (Participant dashboard with places in line, hosted queues, and pull-withdraw).
- **Milestone 7 (Verification, Mutation Check & Handover)**:
  - Mutation check killed 20/25 mutants; all 5 survivors documented in `contracts/DECISIONS.md`.
  - Full verification gates passing: `check-ui-contract.py`, `check-tokens.py`, `check-distinct.py`, `check-honesty.py`, `typecheck`, `test`, `test:integration`, and `build`.

---

## 2. Verification Gate Results

- **`check-ui-contract.py cutline`**: PASSED (0 errors)
- **`check-tokens.py cutline`**: PASSED (0 errors)
- **`check-distinct.py cutline`**: PASSED (0 errors)
- **`check-honesty.py cutline`**: PASSED (0 errors)
- **`npm run typecheck`**: PASSED (0 errors)
- **`npm test`**: PASSED (10 test suites, 47 tests)
- **`npm run test:integration`**: PASSED (2 test suites, 5 tests)
- **`npm run build`**: PASSED (Compiled all static and dynamic routes)

---

## 3. Ports & Environment

- **Integration Port**: `8656`
- **Local Dev Port**: `8756`
- **Network**: BotChain / Anvil (Chain ID `31337`)
