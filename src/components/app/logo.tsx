import { cn } from "@/lib/utils";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Onboardly";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-6", className)}>
      <rect width="24" height="24" rx="6" className="fill-foreground" />
      <path d="M7 12.5l3.2 3.2L17 8.8" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="stroke-background" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      {APP_NAME}
    </span>
  );
}
