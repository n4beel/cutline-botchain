import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  let baseStyles =
    "inline-flex items-center justify-center font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ";

  if (size === "sm") {
    baseStyles += "px-3 py-1.5 text-xs rounded ";
  } else if (size === "lg") {
    baseStyles += "px-6 py-3 text-base rounded-md ";
  } else {
    baseStyles += "px-4 py-2 text-sm rounded-md ";
  }

  if (variant === "primary") {
    baseStyles += "bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-black focus:ring-[var(--accent)] ";
  } else if (variant === "danger") {
    baseStyles += "bg-[var(--danger)] text-white hover:bg-red-700 focus:ring-[var(--danger)] ";
  } else if (variant === "outline") {
    baseStyles += "border border-[var(--border-default)] bg-transparent text-[var(--text-primary)] hover:bg-white/20 focus:ring-[var(--text-primary)] ";
  } else {
    baseStyles += "bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-orange-50 focus:ring-[var(--accent)] ";
  }

  return (
    <button className={`${baseStyles} ${className}`} disabled={disabled} {...props}>
      {children}
    </button>
  );
}
