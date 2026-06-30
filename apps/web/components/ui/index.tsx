"use client";

import React from "react";

/* ───────────────────────────────────────────
   Button — Primary, Secondary, Ghost, Coral
   ─────────────────────────────────────────── */

type ButtonVariant = "primary" | "secondary" | "coral" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)] active:bg-[var(--color-primary-700)] shadow-md hover:shadow-lg",
  secondary:
    "bg-[var(--color-primary-50)] text-[var(--color-primary-600)] hover:bg-[var(--color-primary-100)] active:bg-[var(--color-primary-200)]",
  coral:
    "bg-brand-coral text-white hover:bg-brand-coralHover active:brightness-95 shadow-md hover:shadow-lg",
  ghost:
    "bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] active:bg-[var(--color-border-light)]",
  outline:
    "bg-transparent border-2 border-brand-activeTeal text-brand-activeTeal hover:bg-brand-sageBg/30 active:bg-brand-sageBg/50",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-5 py-2.5 text-sm gap-2",
  lg: "px-7 py-3.5 text-base gap-2.5",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center font-semibold rounded-xl
        transition-all duration-200 ease-out cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
        active:scale-[0.98] select-none
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

/* ───────────────────────────────────────────
   Card — Floating white container
   ─────────────────────────────────────────── */

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  glass?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function Card({
  children,
  className = "",
  hoverable = false,
  glass = false,
  onClick,
  style,
}: CardProps) {
  const base = glass ? "card-glass" : "card";
  const hover = hoverable ? "cursor-pointer hover:-translate-y-1" : "";

  return (
    <div
      className={`${base} ${hover} p-6 md:p-8 ${className}`}
      onClick={onClick}
      style={style}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

/* ───────────────────────────────────────────
   Input — Styled text input
   ─────────────────────────────────────────── */

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({
  label,
  error,
  icon,
  className = "",
  id,
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-semibold text-[var(--color-text-secondary)]"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          className={`input-field ${error ? "error" : ""} ${icon ? "pl-10" : ""} ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs text-[var(--color-error)] font-medium mt-0.5">
          {error}
        </p>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────
   Tabs — Pill-style tab switcher
   ─────────────────────────────────────────── */

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, className = "" }: TabsProps) {
  return (
    <div
      className={`inline-flex bg-[var(--color-surface-muted)] rounded-2xl p-1 gap-0.5 ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`
            px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer
            ${
              activeTab === tab.id
                ?    "bg-brand-activeTeal text-white shadow-md"
                : "text-brand-darkTeal hover:text-brand-activeTeal hover:bg-white/50"
            }
          `}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────────────────────────
   Badge — Micro status badge
   ─────────────────────────────────────────── */

type BadgeVariant = "success" | "warning" | "info" | "neutral" | "coral";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const badgeVariants: Record<BadgeVariant, string> = {
  success:
    "bg-green-100 text-green-800 border border-green-300",
  warning:
    "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning)]/20",
  info:
    "bg-brand-sageBg/30 text-brand-activeTeal border border-brand-sageBorder",
  neutral:
    "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)] border border-[var(--color-border)]",
  coral:
    "bg-[var(--color-accent-light)] text-[var(--color-accent-hover)] border border-[var(--color-accent)]/20",
};

export function Badge({
  children,
  variant = "neutral",
  className = "",
}: BadgeProps) {
  return (
    <span className={`badge ${badgeVariants[variant]} ${className}`}>
      {children}
    </span>
  );
}

/* ───────────────────────────────────────────
   Modal — Overlay dialog
   ─────────────────────────────────────────── */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function Modal({
  open,
  onClose,
  children,
  title,
  className = "",
}: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        className={`relative w-full max-w-md animate-scale-in ${className}`}
      >
        <div className="card p-6 md:p-8">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer"
            aria-label="Close"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {title && (
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4 pr-8">
              {title}
            </h2>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────
   SectionHeading — Reusable section titles
   ─────────────────────────────────────────── */

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeading({
  title,
  subtitle,
  className = "",
}: SectionHeadingProps) {
  return (
    <div className={`mb-6 ${className}`}>
      <h2 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)]">
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────
   InfoBadge — Info blocks for branding side
   ─────────────────────────────────────────── */

interface InfoBadgeProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

export function InfoBadge({ title, description, icon }: InfoBadgeProps) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl bg-brand-peachLight border border-brand-sageBorder/40">
      <div className="w-10 h-10 rounded-xl bg-brand-sageBg flex items-center justify-center text-brand-darkTeal flex-shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-brand-darkTeal text-sm">{title}</h3>
        <p className="text-brand-darkTeal/70 text-xs mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
