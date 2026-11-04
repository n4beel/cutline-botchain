"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, usePublicClient } from "wagmi";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { useWriteContract } from "@/lib/useChainWrite";
import { BOTCHAIN_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { formatBOT } from "@/lib/cutline";
import { formatCutlineError } from "@/lib/errors";
import { LineData, PositionData } from "@/lib/cutline";

interface MyPlace {
  line: LineData;
  position: PositionData;
}

export default function MePage() {
  const { address: userAddress, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const deployment = getDeployment(activeBotChain.id);
  const { writeContractAsync, isPending } = useWriteContract();

  const [pendingBalance, setPendingBalance] = useState<bigint>(0n);
  const [myPlaces, setMyPlaces] = useState<MyPlace[]>([]);
  const [hostedLines, setHostedLines] = useState<LineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadUserData = async () => {
    if (!publicClient || !deployment?.address || !userAddress) {
      setLoading(false);
      return;
    }

    try {
      // 1. Pending balance
      const pend = (await publicClient.readContract({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "pending",
        args: [userAddress],
      })) as bigint;
      setPendingBalance(pend);

      // 2. Scan recent lines to find active positions or hosted lines
      const result = (await publicClient.readContract({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "latest",
        args: [0n, 50n],
      })) as [bigint[], any[], bigint];

      const [ids, rawLines] = result;
      const foundPlaces: MyPlace[] = [];
      const foundHosted: LineData[] = [];

      for (let i = 0; i < ids.length; i++) {
        const l = rawLines[i];
        const lineItem: LineData = {
          id: ids[i],
          host: l.host,
          head: l.head,
          tail: l.tail,
          closed: l.closed,
          entryFee: l.entryFee,
          stepPrice: l.stepPrice,
          name: l.name,
        };

        if (l.host.toLowerCase() === userAddress.toLowerCase()) {
          foundHosted.push(lineItem);
        }

        const posRes = (await publicClient.readContract({
          address: deployment.address,
          abi: BOTCHAIN_ABI,
          functionName: "positionOf",
          args: [ids[i], userAddress],
        })) as [boolean, number, number];

        if (posRes[0]) {
          foundPlaces.push({
            line: lineItem,
            position: { live: posRes[0], position: posRes[1], ahead: posRes[2] },
          });
        }
      }

      setMyPlaces(foundPlaces);
      setHostedLines(foundHosted);
    } catch (e) {
      console.error("Error loading user data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
    const interval = setInterval(loadUserData, 8000);
    return () => clearInterval(interval);
  }, [deployment?.address, userAddress]);

  const handleWithdraw = async () => {
    if (!deployment?.address) return;
    setActionError(null);
    setActionSuccess(null);

    try {
      const tx = await writeContractAsync({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "withdraw",
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }
      setActionSuccess("Withdrawal successful! Funds sent to your wallet.");
      await loadUserData();
    } catch (err) {
      setActionError(formatCutlineError(err));
    }
  };

  return (
    <PageShell
      headline="My Places & Earnings"
      lead="Monitor active queues you are standing in and pull accumulated skip compensation or host fees."
      activeNav="places"
    >
      {/* Earnings Withdrawal Card */}
      <Panel variant="surface" className="mb-6 border-2 border-[var(--border-default)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase font-mono font-bold tracking-wider text-[var(--text-muted)]">
              Pending Compensation & Host Fees
            </span>
            <div className="text-3xl font-black font-mono mt-1 text-[#1B0E00]">
              {formatBOT(pendingBalance)}
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Earned whenever someone jumped ahead of you in line, or when users joined your hosted queues.
            </p>
          </div>
          <div>
            <Button
              size="lg"
              disabled={pendingBalance === 0n || isPending || !isConnected}
              onClick={handleWithdraw}
            >
              {isPending ? "Withdrawing..." : "Withdraw to Wallet"}
            </Button>
          </div>
        </div>
      </Panel>

      {actionError && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-mono">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 font-mono">
          {actionSuccess}
        </div>
      )}

      {/* Two Column Layout: Places in Line vs Hosted Lines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Active Line Places */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm uppercase tracking-wider text-[#1B0E00]">
              Queues You Are In ({myPlaces.length})
            </h3>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs font-mono text-[var(--text-secondary)]">
              Checking lines...
            </div>
          ) : myPlaces.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-[var(--border-default)] rounded-lg p-8 text-center text-xs text-[var(--text-secondary)]">
              You are not waiting in any active queue.
            </div>
          ) : (
            <div className="space-y-3">
              {myPlaces.map(({ line, position }) => (
                <div
                  key={line.id.toString()}
                  className="bg-white border-2 border-[var(--border-default)] rounded-lg p-4 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-sm text-[#1B0E00]">{line.name}</h4>
                      <p className="text-xs text-[var(--text-secondary)] font-mono mt-0.5">
                        Line #{line.id.toString()}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#111111] text-white font-mono text-xs font-bold">
                      Place #{position.position}
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-orange-100 flex items-center justify-between text-xs font-mono">
                    <span className="text-[var(--text-muted)]">
                      {position.position === 1 ? "Next in line" : `${position.ahead} ahead of you`}
                    </span>
                    <Link href={`/line/${line.id}`}>
                      <Button size="sm" variant="outline">
                        Open Queue →
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Hosted Lines */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm uppercase tracking-wider text-[#1B0E00]">
              Queues You Host ({hostedLines.length})
            </h3>
            <Link href="/new">
              <Button size="sm" variant="outline">
                + New
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs font-mono text-[var(--text-secondary)]">
              Checking hosted lines...
            </div>
          ) : hostedLines.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-[var(--border-default)] rounded-lg p-8 text-center text-xs text-[var(--text-secondary)]">
              You haven&apos;t hosted any queues yet.
            </div>
          ) : (
            <div className="space-y-3">
              {hostedLines.map((line) => {
                const liveCount = line.tail - line.head;
                return (
                  <div
                    key={line.id.toString()}
                    className="bg-white border-2 border-[var(--border-default)] rounded-lg p-4 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-sm text-[#1B0E00]">{line.name}</h4>
                        <p className="text-xs text-[var(--text-secondary)] font-mono mt-0.5">
                          Line #{line.id.toString()} • {liveCount} waiting
                        </p>
                      </div>
                      {line.closed ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-200 text-neutral-800">
                          CLOSED
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                          LIVE
                        </span>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-orange-100 flex items-center justify-between text-xs font-mono">
                      <span className="text-[var(--text-muted)]">
                        Entry: {formatBOT(line.entryFee)} • Step: {formatBOT(line.stepPrice)}
                      </span>
                      <Link href={`/line/${line.id}`}>
                        <Button size="sm" variant="primary">
                          Manage →
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
