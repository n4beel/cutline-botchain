"use client";

import React, { useId } from "react";
import { formatBOT } from "@/lib/cutline";
import { passed } from "@/lib/cutline";

interface SwitchbackProps {
  queue: `0x${string}`[];
  userAddress?: `0x${string}`;
  skipSteps: number;
  stepPrice: bigint;
  onSelectPerson?: (addr: `0x${string}`, pos: number) => void;
}

export function Switchback({
  queue,
  userAddress,
  skipSteps,
  stepPrice,
  onSelectPerson,
}: SwitchbackProps) {
  const tableId = useId();

  if (queue.length === 0) {
    return (
      <div className="bg-white/70 border-2 border-dashed border-[var(--border-default)] rounded-lg p-12 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-orange-100 flex items-center justify-center text-xl font-bold mb-3 text-[var(--text-secondary)]">
          0
        </div>
        <h3 className="font-bold text-lg text-[#1B0E00]">The line is empty</h3>
        <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
          No one is currently waiting. Be the first to take position 1!
        </p>
      </div>
    );
  }

  // Find user position (1-based)
  const userPos = userAddress
    ? queue.findIndex((a) => a.toLowerCase() === userAddress.toLowerCase()) + 1
    : 0;

  // Compute passed addresses when user skips
  const { passedAddresses, targetPosition } =
    userPos > 1 && skipSteps > 0
      ? passed(queue, userPos, skipSteps)
      : { passedAddresses: [], targetPosition: userPos };

  const passedSet = new Set(passedAddresses.map((a) => a.toLowerCase()));

  // Switchback serpentine geometry parameters
  const columns = 5; // 5 posts per row
  const rowHeight = 90;
  const colWidth = 100;
  const paddingX = 50;
  const paddingY = 45;
  const totalRows = Math.ceil(queue.length / columns);
  const svgWidth = paddingX * 2 + (columns - 1) * colWidth;
  const svgHeight = paddingY * 2 + Math.max(0, totalRows - 1) * rowHeight;

  // Calculate coordinates for each position (0-based)
  const getCoords = (idx: number) => {
    const row = Math.floor(idx / columns);
    const colInRow = idx % columns;
    const isRtl = row % 2 === 1;
    const effectiveCol = isRtl ? columns - 1 - colInRow : colInRow;
    const x = paddingX + effectiveCol * colWidth;
    const y = paddingY + row * rowHeight;
    return { x, y, isRtl };
  };

  // Generate SVG path connecting all stanchion posts
  let pathD = "";
  for (let i = 0; i < queue.length; i++) {
    const { x, y } = getCoords(i);
    if (i === 0) {
      pathD += `M ${x} ${y}`;
    } else {
      const prev = getCoords(i - 1);
      // If we turned a corner
      if (Math.floor(i / columns) !== Math.floor((i - 1) / columns)) {
        const midY = (prev.y + y) / 2;
        pathD += ` C ${prev.x + (prev.isRtl ? -20 : 20)} ${midY}, ${x + (prev.isRtl ? -20 : 20)} ${midY}, ${x} ${y}`;
      } else {
        pathD += ` L ${x} ${y}`;
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Switchback Serpentine Visual (Desktop/Tablet) */}
      <div className="bg-white border-2 border-[var(--border-default)] rounded-lg p-4 sm:p-6 shadow-xs overflow-x-auto">
        <div className="flex items-center justify-between pb-3 border-b border-orange-100 mb-4">
          <div className="flex items-center gap-2 text-xs font-mono font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>FRONT / SERVING LAMP</span>
          </div>
          <span className="text-xs text-[var(--text-muted)] font-mono">
            {queue.length} {queue.length === 1 ? "person" : "people"} waiting
          </span>
        </div>

        <div className="flex justify-center min-w-[540px]">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full max-w-2xl h-auto"
            style={{ maxHeight: `${Math.max(160, svgHeight)}px` }}
          >
            {/* Stanchion connecting rope */}
            {queue.length > 1 && (
              <path
                d={pathD}
                fill="none"
                className="rope-path"
              />
            )}

            {/* Turnstile / Front Gate Lamp indicator */}
            {queue.length > 0 && (
              <g transform={`translate(${paddingX - 32}, ${paddingY - 14})`}>
                <circle cx="14" cy="14" r="12" fill="#1F7A3D" opacity="0.2" />
                <circle cx="14" cy="14" r="6" fill="#1F7A3D" />
              </g>
            )}

            {/* Individual Stanchion Posts */}
            {queue.map((addr, idx) => {
              const pos = idx + 1;
              const { x, y } = getCoords(idx);
              const isUser = userAddress && addr.toLowerCase() === userAddress.toLowerCase();
              const isPassed = passedSet.has(addr.toLowerCase());
              const isTarget = isUser && skipSteps > 0 && targetPosition === pos;

              let fill = "#FFFFFF";
              let stroke = "#BF6716";
              let textFill = "#1B0E00";

              if (isUser) {
                fill = "#111111";
                stroke = "#FF8A1F";
                textFill = "#FFFFFF";
              } else if (isPassed) {
                fill = "#FFE8D6";
                stroke = "#DF791B";
                textFill = "#8A5A00";
              }

              return (
                <g
                  key={addr + idx}
                  className="post-node cursor-pointer"
                  onClick={() => onSelectPerson?.(addr, pos)}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r="18"
                    fill={fill}
                    stroke={stroke}
                    strokeWidth="3"
                    className="shadow-sm"
                  />
                  <text
                    x={x}
                    y={y + 4}
                    textAnchor="middle"
                    fill={textFill}
                    fontSize="11"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {pos}
                  </text>

                  {/* Skipper Target Marker Preview */}
                  {isTarget && (
                    <circle
                      cx={x}
                      cy={y}
                      r="22"
                      fill="none"
                      stroke="#111111"
                      strokeWidth="2"
                      strokeDasharray="3 3"
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-4 pt-3 border-t border-orange-100 text-xs text-[var(--text-secondary)] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-[#1F7A3D] inline-block"></span>
            <span>Front (Next Served)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-[#111111] inline-block"></span>
            <span>Your Post</span>
          </div>
          {skipSteps > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full bg-[#FFE8D6] border border-[#DF791B] inline-block"></span>
              <span>Passed & Paid (+{formatBOT(stepPrice)})</span>
            </div>
          )}
        </div>
      </div>

      {/* Accessible Table View (Single Column responsive for mobile 360px & screen readers) */}
      <div className="bg-white border-2 border-[var(--border-default)] rounded-lg overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-wider text-[#1B0E00]">
            Queue Order & Compensation Breakdown
          </h3>
          <span className="text-[11px] font-mono text-[var(--text-muted)]">
            Places 1 to {queue.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table id={tableId} className="w-full text-left text-xs">
            <caption className="sr-only">Sequential list of participants in this queue</caption>
            <thead className="bg-orange-100/60 font-mono text-[var(--text-secondary)] border-b border-orange-200">
              <tr>
                <th scope="col" className="py-2.5 px-4">Place</th>
                <th scope="col" className="py-2.5 px-4">Participant Address</th>
                <th scope="col" className="py-2.5 px-4 text-right">Status / Skip Earnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-100 font-mono">
              {queue.map((addr, idx) => {
                const pos = idx + 1;
                const isUser = userAddress && addr.toLowerCase() === userAddress.toLowerCase();
                const isPassed = passedSet.has(addr.toLowerCase());

                let rowBg = "hover:bg-orange-50/50";
                if (isUser) rowBg = "bg-orange-200/40 font-bold";
                else if (isPassed) rowBg = "bg-amber-100/40";

                return (
                  <tr key={addr + idx} className={`${rowBg} transition-colors`}>
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white border border-[var(--border-default)] text-[11px] font-bold">
                        {pos}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[140px] sm:max-w-xs">{addr}</span>
                        {isUser && (
                          <span className="text-[10px] bg-[#111111] text-white px-1.5 py-0.5 rounded font-sans">
                            YOU
                          </span>
                        )}
                        {pos === 1 && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded font-sans">
                            FRONT
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {isPassed ? (
                        <span className="text-amber-800 font-bold">
                          +{formatBOT(stepPrice)} (Passed)
                        </span>
                      ) : pos === 1 ? (
                        <span className="text-emerald-700">Next to be served</span>
                      ) : (
                        <span className="text-[var(--text-muted)]">Waiting in line</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
