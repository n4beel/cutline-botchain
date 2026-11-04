"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, usePublicClient } from "wagmi";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { BOTCHAIN_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { formatBOT } from "@/lib/cutline";
import { LineData } from "@/lib/cutline";

export default function HomePage() {
  const { isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const deployment = getDeployment(activeBotChain.id);

  const [lines, setLines] = useState<LineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open">("all");

  useEffect(() => {
    async function loadLines() {
      if (!publicClient || !deployment?.address) {
        setLoading(false);
        return;
      }
      try {
        const result = (await publicClient.readContract({
          address: deployment.address,
          abi: BOTCHAIN_ABI,
          functionName: "latest",
          args: [0n, 50n],
        })) as [bigint[], any[], bigint];

        const [ids, rawLines] = result;
        const parsed: LineData[] = [];
        for (let i = 0; i < ids.length; i++) {
          const l = rawLines[i];
          parsed.push({
            id: ids[i],
            host: l.host,
            head: l.head,
            tail: l.tail,
            closed: l.closed,
            entryFee: l.entryFee,
            stepPrice: l.stepPrice,
            name: l.name,
          });
        }
        setLines(parsed);
      } catch (e) {
        console.error("Failed to load lines", e);
      } finally {
        setLoading(false);
      }
    }
    loadLines();
    const interval = setInterval(loadLines, 8000);
    return () => clearInterval(interval);
  }, [deployment?.address]);

  const displayedLines = lines.filter((l) => (filter === "open" ? !l.closed : true));

  return (
    <PageShell
      headline="Public Queues"
      lead="Pay to move up the line. The people you pass get paid."
      activeNav="lines"
      controls={
        <div className="flex items-center gap-2">
          <Link href="/new">
            <Button size="sm" variant="primary">
              + Host a Line
            </Button>
          </Link>
        </div>
      }
    >
      {/* Required Disclaimer Banner: What it cannot do */}
      <Panel variant="surface" className="mb-6 border-l-4 border-l-[#111111] bg-orange-50/80">
        <h2 className="font-bold text-xs uppercase tracking-wider text-[#1B0E00] mb-1">
          What a place in line means
        </h2>
        <ul className="text-xs text-[var(--text-secondary)] space-y-1 list-disc list-inside">
          <li>
            It is a place on this list. The host decides when and whether to serve participants.
          </li>
          <li>
            Skipping pays the people you pass, not the host.
          </li>
          <li>
            The entry fee is not refundable; it belongs to the host upon joining.
          </li>
        </ul>
      </Panel>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 text-xs font-mono rounded cursor-pointer ${
              filter === "all"
                ? "bg-[#111111] text-white font-bold"
                : "bg-white text-[var(--text-secondary)] border border-orange-200 hover:bg-orange-50"
            }`}
          >
            All Lines ({lines.length})
          </button>
          <button
            onClick={() => setFilter("open")}
            className={`px-3 py-1 text-xs font-mono rounded cursor-pointer ${
              filter === "open"
                ? "bg-[#111111] text-white font-bold"
                : "bg-white text-[var(--text-secondary)] border border-orange-200 hover:bg-orange-50"
            }`}
          >
            Open Lines ({lines.filter((l) => !l.closed).length})
          </button>
        </div>
        <span className="text-xs font-mono text-[var(--text-muted)]">
          Auto-updating every 8s
        </span>
      </div>

      {/* Lines Listing as Ticket Slips */}
      {loading ? (
        <div className="p-12 text-center text-xs font-mono text-[var(--text-secondary)]">
          Scanning lines...
        </div>
      ) : displayedLines.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-[var(--border-default)] rounded-lg p-12 text-center">
          <p className="font-bold text-[#1B0E00] text-sm mb-1">No queues found</p>
          <p className="text-xs text-[var(--text-secondary)] mb-4">
            Be the first host to open a line on Cutline.
          </p>
          <Link href="/new">
            <Button size="sm">Create First Line</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedLines.map((line) => {
            const queueLength = line.tail - line.head;
            return (
              <Link
                key={line.id.toString()}
                href={`/line/${line.id}`}
                className="block group"
              >
                <div className="bg-white border-2 border-[var(--border-default)] hover:border-[#111111] rounded-lg p-4 transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Ticket Header & Info */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded bg-[#FF8A1F] text-[#1B0E00] font-mono font-bold flex items-center justify-center shrink-0 border border-black/20">
                      #{line.id.toString()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base text-[#1B0E00] group-hover:underline">
                          {line.name}
                        </h3>
                        {line.closed ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-200 text-neutral-800 border border-neutral-300">
                            CLOSED
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                            LIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] font-mono mt-0.5">
                        Host: {line.host.slice(0, 6)}...{line.host.slice(-4)}
                      </p>
                    </div>
                  </div>

                  {/* Right: Metrics / Ticket Stub Strip */}
                  <div className="flex items-center gap-4 sm:gap-6 font-mono text-xs border-t md:border-t-0 md:border-l border-orange-100 pt-3 md:pt-0 md:pl-6">
                    <div>
                      <span className="block text-[10px] uppercase text-[var(--text-muted)]">
                        In Line
                      </span>
                      <span className="font-bold text-sm text-[#1B0E00]">
                        {queueLength} {queueLength === 1 ? "person" : "people"}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] uppercase text-[var(--text-muted)]">
                        Entry Fee
                      </span>
                      <span className="font-bold text-[#1B0E00]">
                        {formatBOT(line.entryFee)}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] uppercase text-[var(--text-muted)]">
                        Step Price
                      </span>
                      <span className="font-bold text-amber-800">
                        {formatBOT(line.stepPrice)}
                      </span>
                    </div>

                    <div className="hidden sm:block">
                      <Button size="sm" variant="outline" className="pointer-events-none">
                        View Queue →
                      </Button>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
