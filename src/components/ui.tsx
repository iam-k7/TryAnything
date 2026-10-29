import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Logo() {
  return <span className="text-[17px] font-semibold tracking-tight">TryAnything</span>;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" };

export function Button({ className = "", variant = "primary", type = "button", ...rest }: BtnProps) {
  const look =
    variant === "primary"
      ? "bg-fg text-white hover:bg-black"
      : "border border-line bg-surface text-fg hover:border-fg/40";
  return (
    <button
      type={type}
      {...rest}
      className={`inline-flex min-h-11 items-center justify-center rounded-md px-4 text-[15px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${look} ${className}`}
    />
  );
}

export function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-5">
      <h2 className="mb-3 text-[15px] font-semibold">
        <span className="mr-2 text-muted">{step}.</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export const LEGAL_LINKS = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/aup", label: "Acceptable use" },
] as const;
