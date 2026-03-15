import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

export function AppSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "mx-auto min-h-[100dvh] w-full max-w-6xl overflow-x-clip px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-[max(env(safe-area-inset-top),1.25rem)] sm:px-6 sm:pt-6 lg:px-8",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-4xl border border-white/60 bg-white/90 p-5 shadow-panel backdrop-blur md:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-2">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sea/70">{eyebrow}</p>
      ) : null}
      <h2 className="text-balance text-2xl font-semibold text-ink sm:text-3xl">{title}</h2>
      {description ? <p className="max-w-2xl text-sm text-ink/70 sm:text-base">{description}</p> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "success" | "warning" | "danger";
}) {
  const tones = {
    default: "bg-ink/6 text-ink/75",
    accent: "bg-sea/10 text-sea",
    success: "bg-mint/15 text-ink",
    warning: "bg-gold/20 text-ink",
    danger: "bg-coral/15 text-coral",
  };

  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]", tones[tone])}>
      {children}
    </span>
  );
}

export function Button({
  className,
  children,
  tone = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const tones = {
    primary: "bg-ink text-white hover:bg-ink/90",
    secondary: "bg-sea text-white hover:bg-sea/90",
    ghost: "bg-ink/5 text-ink hover:bg-ink/10",
    danger: "bg-coral text-white hover:bg-coral/90",
  };

  return (
    <button
      className={cn(
        "min-h-11 rounded-full px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea/50 disabled:cursor-not-allowed disabled:opacity-50",
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-base text-ink shadow-sm outline-none transition placeholder:text-ink/35 focus:border-sea/40 focus:ring-2 focus:ring-sea/15 sm:text-sm",
        props.className,
      )}
      {...props}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[120px] w-full rounded-3xl border border-ink/10 bg-white px-4 py-3 text-base text-ink shadow-sm outline-none transition placeholder:text-ink/35 focus:border-sea/40 focus:ring-2 focus:ring-sea/15 sm:text-sm",
        props.className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "min-h-11 w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-base text-ink shadow-sm outline-none transition focus:border-sea/40 focus:ring-2 focus:ring-sea/15 sm:text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
