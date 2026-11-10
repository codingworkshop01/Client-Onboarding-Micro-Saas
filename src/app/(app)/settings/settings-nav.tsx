"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings", label: "Workspace & brand" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/payments", label: "Payments" },
  { href: "/settings/billing", label: "Plan & billing" },
  { href: "/settings/integrations", label: "Integrations" },
];

export function SettingsNav() {
  const path = usePathname();
  return (
    <nav className="scrollbar-none flex gap-1 overflow-x-auto border-b" aria-label="Settings">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={path === t.href ? "page" : undefined}
          className={cn("-mb-px border-b-2 px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors", path === t.href ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
