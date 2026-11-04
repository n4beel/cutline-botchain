# Cutline (`cutline-botchain`)

Pay to move up the line. The people you pass get paid.

Cutline is a decentralized queue protocol where waiting participants are directly compensated by impatient skippers. Line hosts establish queues (for clinics, signing lines, demo booths, or ticket releases) with an entry fee and step price. Participants can pay step increments to advance up to 10 places, paying the individuals they pass rather than the house.

---

## Design System & Theme

- **Archetype**: AO — Switchback (Serpentine rope stanchion visualization)
- **Palette**:
  - Ground: `#FF8A1F` (Warm orange)
  - Ink: `#1B0E00` (Deep warm dark brown)
  - Accent: `#111111` (Black button accent)
  - Accent Ink: `#FFFFFF`
  - Surface: `#FFFFFF`
- **Typography**:
  - Primary UI Font: Space Grotesk
  - Monospace Data Font: IBM Plex Mono
- **Measured WCAG Contrast Ratios**:
  - Ink (`#1B0E00`) on Ground (`#FF8A1F`): **8.03:1** (AAA)
  - Ink (`#1B0E00`) on Surface (`#FFFFFF`): **18.93:1** (AAA)
  - Muted Text (`#5B3109`) on Surface (`#FFFFFF`): **11.12:1** (AAA)
  - Accent-Ink (`#FFFFFF`) on Accent (`#111111`): **18.88:1** (AAA)
  - Menu Text (`#1B0E00`) on Menu Bg (`#FFFFFF`): **18.93:1** (AAA)
  - Menu Muted (`#7B736B`) on Menu Bg (`#FFFFFF`): **4.66:1** (AA)

---

## Key Features

- **Switchback Serpentine Visualization**: Roped queue path displaying participants as numbered stanchions, with active front serving lamp and live interactive skip previews.
- **Accessible Queue Table**: Complete tabular breakdown of places, addresses, and compensation for screen readers and mobile viewport widths down to 360 px without horizontal overflow.
- **Sideways Compensation**: Skipping directly credits `stepPrice` into the `pending` balance of each individual passed.
- **Host Administration**: Real-time console for hosts to serve the next participant or close the queue.
- **Pull Withdrawals**: Non-reentrant single-transaction withdrawal for accrued skip earnings and host entry fees.

---

## Running Locally

```bash
# Install dependencies
npm install

# Start local dev stack (Anvil on port 8756 + contract deployment + seeded lines)
node scripts/local-stack.mjs

# Run Next.js web application
npm run dev
```

---

## Testing & Verification

```bash
# Foundry unit, fuzz, and invariant tests
cd contracts && forge test

# TypeScript typecheck
npm run typecheck

# Unit tests
npm test

# Integration tests (against isolated Anvil on port 8656)
npm run test:integration

# Next.js production build
npm run build
```
