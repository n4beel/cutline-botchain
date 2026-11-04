// Constants and pure utility functions for Cutline
export const MAX_NAME_BYTES = 48;
export const MAX_QUEUE = 500;
export const MAX_SKIP = 10;
export const MAX_PAGE = 50;

export interface LineData {
  id: bigint;
  host: `0x${string}`;
  head: number;
  tail: number;
  closed: boolean;
  entryFee: bigint;
  stepPrice: bigint;
  name: string;
}

export interface PositionData {
  live: boolean;
  position: number;
  ahead: number;
}

/**
 * Pure calculation of skip cost matching contract
 */
export function quoteSkip(stepPrice: bigint, steps: number): bigint {
  if (steps <= 0) return 0n;
  return stepPrice * BigInt(steps);
}

/**
 * Maximum steps allowed from a given 1-based position
 */
export function maxSteps(position: number): number {
  if (position <= 1) return 0;
  const available = position - 1;
  return Math.min(available, MAX_SKIP);
}

/**
 * Pure mirror of contract shift logic for previewing who is passed
 * liveQueue is front-to-back array of addresses [pos 1, pos 2, ..., pos N]
 * position is 1-based position of the skipper
 * steps is number of steps to skip
 */
export function passed(
  liveQueue: readonly `0x${string}`[],
  position: number,
  steps: number
): { passedAddresses: `0x${string}`[]; targetPosition: number } {
  if (position <= 1 || steps <= 0) {
    return { passedAddresses: [], targetPosition: position };
  }

  const clampedSteps = Math.min(steps, position - 1, MAX_SKIP);
  const currentIdx = position - 1;
  const targetIdx = currentIdx - clampedSteps;

  const passedAddresses: `0x${string}`[] = [];
  for (let i = currentIdx - 1; i >= targetIdx; i--) {
    if (i >= 0 && i < liveQueue.length) {
      passedAddresses.push(liveQueue[i]);
    }
  }

  return {
    passedAddresses,
    targetPosition: targetIdx + 1,
  };
}

/**
 * Layout helper for switchback serpentine path
 * Turns an ordered list of addresses into rows of alternating direction
 */
export function rowsForPath<T>(items: readonly T[], columnsPerRow: number = 5): { items: T[]; rtl: boolean; startIndex: number }[] {
  if (items.length === 0) return [];
  const rows: { items: T[]; rtl: boolean; startIndex: number }[] = [];
  const cols = Math.max(1, columnsPerRow);

  for (let i = 0; i < items.length; i += cols) {
    const slice = items.slice(i, i + cols);
    const rowIndex = Math.floor(i / cols);
    const isRtl = rowIndex % 2 === 1;
    rows.push({
      items: isRtl ? [...slice].reverse() : [...slice],
      rtl: isRtl,
      startIndex: i,
    });
  }

  return rows;
}
