import { describe, it, expect } from "vitest";
import { quoteSkip, maxSteps, passed, rowsForPath, MAX_NAME_BYTES, MAX_QUEUE, MAX_SKIP, MAX_PAGE } from "../cutline";

describe("Cutline Pure Helpers", () => {
  it("quotes skip correctly", () => {
    const stepPrice = 10_000_000_000_000_000n; // 0.01 BOT
    expect(quoteSkip(stepPrice, 0)).toBe(0n);
    expect(quoteSkip(stepPrice, 1)).toBe(stepPrice);
    expect(quoteSkip(stepPrice, 5)).toBe(50_000_000_000_000_000n);
    expect(quoteSkip(stepPrice, 10)).toBe(100_000_000_000_000_000n);
  });

  it("calculates max steps accurately", () => {
    expect(maxSteps(0)).toBe(0);
    expect(maxSteps(1)).toBe(0); // At the front
    expect(maxSteps(2)).toBe(1);
    expect(maxSteps(5)).toBe(4);
    expect(maxSteps(11)).toBe(10); // Capped at MAX_SKIP
    expect(maxSteps(50)).toBe(10);
  });

  it("mirrors contract passed logic", () => {
    const addresses: `0x${string}`[] = [
      "0x1111111111111111111111111111111111111111", // Pos 1
      "0x2222222222222222222222222222222222222222", // Pos 2
      "0x3333333333333333333333333333333333333333", // Pos 3
      "0x4444444444444444444444444444444444444444", // Pos 4
      "0x5555555555555555555555555555555555555555", // Pos 5
    ];

    // Person at pos 4 skips 2 places (passes pos 3 and pos 2)
    const result = passed(addresses, 4, 2);
    expect(result.targetPosition).toBe(2);
    expect(result.passedAddresses).toEqual([
      "0x3333333333333333333333333333333333333333",
      "0x2222222222222222222222222222222222222222",
    ]);

    // Person at pos 1 cannot skip
    const frontResult = passed(addresses, 1, 1);
    expect(frontResult.passedAddresses).toEqual([]);
    expect(frontResult.targetPosition).toBe(1);
  });

  it("calculates rowsForPath switchback alternating layout", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const rows = rowsForPath(items, 4);
    expect(rows.length).toBe(2);
    expect(rows[0].rtl).toBe(false);
    expect(rows[0].items).toEqual([1, 2, 3, 4]);
    expect(rows[1].rtl).toBe(true);
    expect(rows[1].items).toEqual([8, 7, 6, 5]);
  });

  it("exports correct contract constants", () => {
    expect(MAX_NAME_BYTES).toBe(48);
    expect(MAX_QUEUE).toBe(500);
    expect(MAX_SKIP).toBe(10);
    expect(MAX_PAGE).toBe(50);
  });
});
