"use client";

import React, { useEffect, useState, use } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Switchback } from "@/components/queue/Switchback";
import { useWriteContract } from "@/lib/useChainWrite";
import { BOTCHAIN_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { formatBOT } from "@/lib/cutline";
import { formatCutlineError } from "@/lib/errors";
import { LineData, PositionData, maxSteps, passed, quoteSkip } from "@/lib/cutline";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function LineDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const lineId = BigInt(resolvedParams.id);

  const { address: userAddress, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const deployment = getDeployment(activeBotChain.id);
  const { writeContractAsync, isPending } = useWriteContract();

  const [line, setLine] = useState<LineData | null>(null);
  const [queue, setQueue] = useState<`0x${string}`[]>([]);
  const [userPos, setUserPos] = useState<PositionData>({ live: false, position: 0, ahead: 0 });
  const [skipSteps, setSkipSteps] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Load line state
  const refreshLine = async () => {
    if (!publicClient || !deployment?.address) return;
    try {
      const lineRes = (await publicClient.readContract({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "lineOf",
        args: [lineId],
      })) as any;

      const loadedLine: LineData = {
        id: lineId,
        host: lineRes.host,
        head: lineRes.head,
        tail: lineRes.tail,
        closed: lineRes.closed,
        entryFee: lineRes.entryFee,
        stepPrice: lineRes.stepPrice,
        name: lineRes.name,
      };
      setLine(loadedLine);

      const liveCount = lineRes.tail - lineRes.head;
      if (liveCount > 0) {
        const slice = (await publicClient.readContract({
          address: deployment.address,
          abi: BOTCHAIN_ABI,
          functionName: "queueSlice",
          args: [lineId, 0, 50],
        })) as `0x${string}`[];
        setQueue(slice);
      } else {
        setQueue([]);
      }

      if (userAddress) {
        const posRes = (await publicClient.readContract({
          address: deployment.address,
          abi: BOTCHAIN_ABI,
          functionName: "positionOf",
          args: [lineId, userAddress],
        })) as [boolean, number, number];
        setUserPos({ live: posRes[0], position: posRes[1], ahead: posRes[2] });
      }
    } catch (e) {
      console.error("Error refreshing line", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshLine();
    const interval = setInterval(refreshLine, 5000);
    return () => clearInterval(interval);
  }, [deployment?.address, lineId, userAddress]);

  const isHost = userAddress && line && userAddress.toLowerCase() === line.host.toLowerCase();
  const maxAvailableSteps = maxSteps(userPos.position);

  // Handlers
  const handleJoin = async () => {
    if (!deployment?.address || !line) return;
    setActionError(null);
    setActionSuccess(null);

    try {
      const tx = await writeContractAsync({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "join",
        args: [lineId],
        value: line.entryFee,
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }
      setActionSuccess("Joined the line at the back!");
      await refreshLine();
    } catch (err) {
      setActionError(formatCutlineError(err));
    }
  };

  const handleSkip = async () => {
    if (!deployment?.address || !line) return;
    setActionError(null);
    setActionSuccess(null);

    const cost = quoteSkip(line.stepPrice, skipSteps);

    try {
      const tx = await writeContractAsync({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "skip",
        args: [lineId, skipSteps],
        value: cost,
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }
      setActionSuccess(`Moved forward ${skipSteps} places! The people passed were compensated.`);
      await refreshLine();
    } catch (err) {
      setActionError(formatCutlineError(err));
    }
  };

  const handleServe = async () => {
    if (!deployment?.address || !line) return;
    setActionError(null);
    setActionSuccess(null);

    try {
      const tx = await writeContractAsync({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "serve",
        args: [lineId],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }
      setActionSuccess("Served next participant in line!");
      await refreshLine();
    } catch (err) {
      setActionError(formatCutlineError(err));
    }
  };

  const handleClose = async () => {
    if (!deployment?.address || !line) return;
    setActionError(null);
    setActionSuccess(null);

    try {
      const tx = await writeContractAsync({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "close",
        args: [lineId],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }
      setActionSuccess("Line closed to new joins.");
      await refreshLine();
    } catch (err) {
      setActionError(formatCutlineError(err));
    }
  };

  if (loading || !line) {
    return (
      <PageShell headline="Queue Loading..." activeNav="lines">
        <div className="p-12 text-center font-mono text-xs text-[var(--text-secondary)]">
          Reading line state from blockchain...
        </div>
      </PageShell>
    );
  }

  const { passedAddresses } =
    userPos.live && userPos.position > 1 && skipSteps > 0
      ? passed(queue, userPos.position, skipSteps)
      : { passedAddresses: [] };

  return (
    <PageShell
      headline={line.name}
      lead={`Line #${line.id.toString()} • Host: ${line.host}`}
      activeNav="lines"
      pill={
        line.closed ? (
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-neutral-200 text-neutral-800">
            CLOSED
          </span>
        ) : (
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
            LIVE
          </span>
        )
      }
    >
      {/* Host Console Bar (if caller is host) */}
      {isHost && (
        <div className="mb-6 p-4 rounded-lg bg-[#1B0E00] text-white border border-[#3B1F04] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-orange-200">
                Host Console
              </span>
            </div>
            <p className="text-xs text-white/70 mt-0.5">
              Serve who is at the front, or close this line when full.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="primary"
              disabled={queue.length === 0 || isPending}
              onClick={handleServe}
            >
              {queue.length === 0 ? "Line Empty" : "Serve Next"}
            </Button>
            {!line.closed && (
              <Button
                size="sm"
                variant="danger"
                disabled={isPending}
                onClick={handleClose}
              >
                Close Line
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Action feedback notifications */}
      {actionError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
          {actionSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Switchback Visual + Table */}
        <div className="lg:col-span-2 space-y-6">
          <Switchback
            queue={queue}
            userAddress={userAddress}
            skipSteps={userPos.live ? skipSteps : 0}
            stepPrice={line.stepPrice}
          />
        </div>

        {/* Right Column (1 Col): Join & Skip Controls */}
        <div className="space-y-6">
          {/* Status Box */}
          <Panel variant="surface">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#1B0E00] border-b pb-2 mb-3">
              Line Summary
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Entry Fee (to Host)</span>
                <span className="font-bold">{formatBOT(line.entryFee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Step Price (per person)</span>
                <span className="font-bold text-amber-800">{formatBOT(line.stepPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Live Length</span>
                <span className="font-bold">{queue.length} waiting</span>
              </div>
            </div>
          </Panel>

          {/* Join Panel if not live in line */}
          {!userPos.live && (
            <Panel variant="surface" className="border-2 border-[var(--border-default)]">
              <h3 className="font-bold text-sm text-[#1B0E00] mb-1">Join the Queue</h3>
              <p className="text-xs text-[var(--text-secondary)] mb-4">
                Take your place at the back (position {queue.length + 1}). Entry fee goes to host.
              </p>
              {isHost ? (
                <div className="p-3 bg-orange-100/60 rounded text-xs text-[var(--text-secondary)] font-mono">
                  You are the host of this line. Use Serve to process waiting participants.
                </div>
              ) : line.closed ? (
                <div className="p-3 bg-neutral-100 rounded text-xs text-neutral-600 font-mono">
                  This line is closed to new entries.
                </div>
              ) : (
                <Button
                  className="w-full"
                  disabled={isPending || !isConnected}
                  onClick={handleJoin}
                >
                  {isPending ? "Joining..." : `Join for ${formatBOT(line.entryFee)}`}
                </Button>
              )}
            </Panel>
          )}

          {/* Skip Panel if currently in line */}
          {userPos.live && (
            <Panel variant="surface" className="border-2 border-[#111111]">
              <div className="flex items-center justify-between border-b pb-2 mb-3">
                <h3 className="font-bold text-sm text-[#1B0E00]">Your Place: #{userPos.position}</h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#111111] text-white">
                  {userPos.position === 1 ? "AT FRONT" : `${userPos.ahead} AHEAD`}
                </span>
              </div>

              {userPos.position === 1 ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 font-mono">
                  Nothing ahead of you! You are next to be served by the host.
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-[var(--text-secondary)]">
                        Skip Slider (1–{maxAvailableSteps})
                      </span>
                      <span className="font-mono font-bold text-[#1B0E00]">
                        Skip {skipSteps} {skipSteps === 1 ? "place" : "places"}
                      </span>
                    </div>

                    <input
                      type="range"
                      min={1}
                      max={Math.max(1, maxAvailableSteps)}
                      value={skipSteps}
                      onChange={(e) => setSkipSteps(Number(e.target.value))}
                      className="w-full cursor-pointer accent-[#111111]"
                      disabled={maxAvailableSteps < 1}
                    />
                  </div>

                  {/* Skip Preview */}
                  <div className="bg-orange-50/70 border border-orange-200 rounded p-3 text-xs space-y-1.5">
                    <p className="font-bold text-[#1B0E00]">
                      You would pass {skipSteps} {skipSteps === 1 ? "person" : "people"} and pay each {formatBOT(line.stepPrice)}.
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] font-mono">
                      Target Position: #{userPos.position - skipSteps} • Total Cost: {formatBOT(quoteSkip(line.stepPrice, skipSteps))}
                    </p>
                    {passedAddresses.length > 0 && (
                      <div className="pt-1 text-[11px] text-[var(--text-secondary)] font-mono truncate">
                        Passing: {passedAddresses.map((a) => `${a.slice(0, 6)}...${a.slice(-4)}`).join(", ")}
                      </div>
                    )}
                  </div>

                  <Button
                    className="w-full"
                    disabled={isPending || maxAvailableSteps < 1}
                    onClick={handleSkip}
                  >
                    {isPending ? "Moving up..." : `Move Up for ${formatBOT(quoteSkip(line.stepPrice, skipSteps))}`}
                  </Button>
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </PageShell>
  );
}
