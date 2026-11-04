import React from "react";
import Link from "next/link";
import ConnectButton from "../ui/ConnectButton";
import BuiltOnBotChain from "../botchain/BuiltOnBotChain";
import { footerLinks } from "@/lib/botchain/chain";

export interface PageShellProps {
  children: React.ReactNode;
  headline?: string;
  lead?: string;
  pill?: React.ReactNode;
  controls?: React.ReactNode;
  activeNav?: "lines" | "create" | "places";
}

export function PageShell({
  children,
  headline,
  lead,
  pill,
  controls,
  activeNav = "lines",
}: PageShellProps) {
  const { site, explorer } = footerLinks();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)] font-sans selection:bg-[#111111] selection:text-white">
      {/* Turnstile / Stanchion Masthead Bar */}
      <div className="bg-[#111111] text-white border-b-4 border-[#1B0E00] px-4 py-3 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="w-6 h-6 rounded-full bg-[#FF8A1F] border border-black inline-flex items-center justify-center text-xs font-black text-black">
                Q
              </span>
              <span className="font-bold text-lg tracking-tight uppercase font-mono text-[#FF8A1F]">
                CUTLINE
              </span>
            </Link>
            <nav className="hidden sm:flex items-center gap-2 text-xs font-mono">
              <Link
                href="/"
                className={`px-3 py-1 rounded transition-colors ${
                  activeNav === "lines"
                    ? "bg-[#FF8A1F] text-[#1B0E00] font-bold"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                All Queues
              </Link>
              <Link
                href="/new"
                className={`px-3 py-1 rounded transition-colors ${
                  activeNav === "create"
                    ? "bg-[#FF8A1F] text-[#1B0E00] font-bold"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                Host Line
              </Link>
              <Link
                href="/me"
                className={`px-3 py-1 rounded transition-colors ${
                  activeNav === "places"
                    ? "bg-[#FF8A1F] text-[#1B0E00] font-bold"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                My Earnings
              </Link>
            </nav>
          </div>
          <div>
            <ConnectButton />
          </div>
        </div>
      </div>

      {/* Switchback Headline Ribbon */}
      {(headline || lead || controls) && (
        <section className="bg-white border-b-2 border-[var(--border-default)] px-4 py-4 sm:px-6">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                {headline && <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1B0E00]">{headline}</h1>}
                {pill}
              </div>
              {lead && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{lead}</p>}
            </div>
            {controls && <div className="flex items-center gap-2">{controls}</div>}
          </div>
        </section>
      )}

      {/* Queue Floor Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 sm:px-6">{children}</main>

      {/* Required 3-link Footer */}
      <footer className="border-t-2 border-[#1B0E00] bg-[#111111] text-white/70 text-xs px-4 py-4 sm:px-6 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
          <BuiltOnBotChain />
          <div className="flex items-center gap-6">
            <a href={site} target="_blank" rel="noreferrer" className="hover:text-[#FF8A1F]">
              botchain.ai
            </a>
            <a href={explorer} target="_blank" rel="noreferrer" className="hover:text-[#FF8A1F]">
              BOT Chain Explorer
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PageShell;
