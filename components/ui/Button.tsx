import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
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
  } else if (variant === "ghost") {
    baseStyles += "bg-transparent text-[var(--text-primary)] hover:bg-white/20 focus:ring-[var(--accent)] ";
  } else {
    baseStyles += "bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-orange-50 focus:ring-[var(--accent)] ";
  }

  return (
    <button className={`${baseStyles} ${className}`} disabled={disabled || loading} {...props}>
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export default Button;
