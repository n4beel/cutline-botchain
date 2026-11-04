"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { parseEther } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useWriteContract } from "@/lib/useChainWrite";
import { BOTCHAIN_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { formatCutlineError } from "@/lib/errors";
import { MAX_NAME_BYTES } from "@/lib/cutline";

export default function NewLinePage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const deployment = getDeployment(activeBotChain.id);
  const { writeContractAsync, isPending } = useWriteContract();

  const [name, setName] = useState("");
  const [entryFee, setEntryFee] = useState("0");
  const [stepPrice, setStepPrice] = useState("0.01");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isConnected) {
      setError("Please connect your wallet first.");
      return;
    }

    if (!name.trim()) {
      setError("Please provide a name for this line.");
      return;
    }

    if (new TextEncoder().encode(name.trim()).length > MAX_NAME_BYTES) {
      setError(`Name is too long (maximum ${MAX_NAME_BYTES} bytes).`);
      return;
    }

    let parsedEntryFee = 0n;
    try {
      parsedEntryFee = parseEther(entryFee || "0");
    } catch {
      setError("Invalid entry fee amount.");
      return;
    }

    let parsedStepPrice = 0n;
    try {
      parsedStepPrice = parseEther(stepPrice);
      if (parsedStepPrice <= 0n) {
        setError("Step price must be greater than zero.");
        return;
      }
    } catch {
      setError("Invalid step price amount.");
      return;
    }

    if (!deployment?.address) {
      setError("Contract not deployed on this network.");
      return;
    }

    try {
      const txHash = await writeContractAsync({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "create",
        args: [name.trim(), parsedEntryFee, parsedStepPrice],
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }

      router.push("/");
    } catch (err) {
      setError(formatCutlineError(err));
    }
  };

  return (
    <PageShell
      headline="Host a New Line"
      lead="Create an onchain queue. Set the entry fee for yourself and the step compensation for participants."
      activeNav="create"
    >
      <div className="max-w-xl mx-auto">
        <Panel variant="surface">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-[var(--text-secondary)] mb-1">
                Line Name (Clinic, Demo, Signing, Stall)
              </label>
              <Input
                type="text"
                placeholder="e.g. VIP Morning Consultation"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={48}
                required
              />
              <p className="text-[11px] text-[var(--text-muted)] font-mono mt-1">
                Max 48 bytes ({new TextEncoder().encode(name).length}/48 bytes)
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono font-bold uppercase text-[var(--text-secondary)] mb-1">
                  Entry Fee (BOT)
                </label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.0"
                  value={entryFee}
                  onChange={(e) => setEntryFee(e.target.value)}
                  required
                />
                <p className="text-[11px] text-[var(--text-muted)] font-mono mt-1">
                  Paid to you (the host) upon join
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold uppercase text-[var(--text-secondary)] mb-1">
                  Step Price (BOT)
                </label>
                <Input
                  type="number"
                  step="any"
                  min="0.0001"
                  placeholder="0.01"
                  value={stepPrice}
                  onChange={(e) => setStepPrice(e.target.value)}
                  required
                />
                <p className="text-[11px] text-[var(--text-muted)] font-mono mt-1">
                  Paid directly to each person passed
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating Line..." : "Open Line"}
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </PageShell>
  );
}
