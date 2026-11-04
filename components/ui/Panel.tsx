import React from "react";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "surface" | "subtle" | "dark";
}

export function Panel({
  variant = "surface",
  className = "",
  children,
  ...props
}: PanelProps) {
  let styles = "rounded-lg border p-5 shadow-sm ";

  if (variant === "surface") {
    styles += "bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-primary)] ";
  } else if (variant === "dark") {
    styles += "bg-[#1B0E00] border-[#3B1F04] text-white ";
  } else {
    styles += "bg-white/40 border-[var(--border-subtle)] text-[var(--text-primary)] backdrop-blur-xs ";
  }

  return (
    <div className={`${styles} ${className}`} {...props}>
      {children}
    </div>
  );
}

export default Panel;
