import { describe, it, expect } from "vitest";
import { BOTCHAIN_ABI } from "../botchain/abi";

describe("Cutline ABI and Contract Limits", () => {
  it("ABI contains all required cutline functions", () => {
    const fnNames = BOTCHAIN_ABI.filter((x) => x.type === "function").map((x: any) => x.name);
    expect(fnNames).toContain("create");
    expect(fnNames).toContain("join");
    expect(fnNames).toContain("skip");
    expect(fnNames).toContain("serve");
    expect(fnNames).toContain("close");
    expect(fnNames).toContain("withdraw");
    expect(fnNames).toContain("lineOf");
    expect(fnNames).toContain("positionOf");
    expect(fnNames).toContain("quoteSkip");
    expect(fnNames).toContain("queueSlice");
    expect(fnNames).toContain("latest");
    expect(fnNames).toContain("pending");
    expect(fnNames).toContain("lineCount");
  });

  it("ABI contains all required cutline events", () => {
    const eventNames = BOTCHAIN_ABI.filter((x) => x.type === "event").map((x: any) => x.name);
    expect(eventNames).toContain("Created");
    expect(eventNames).toContain("Joined");
    expect(eventNames).toContain("Skipped");
    expect(eventNames).toContain("Served");
    expect(eventNames).toContain("Closed");
    expect(eventNames).toContain("Withdrawn");
  });
});
