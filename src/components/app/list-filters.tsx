"use client";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** URL-driven search + status filter chips. */
export function ListFilters({ filters, placeholder, extra }: { filters?: { value: string; label: string }[]; placeholder: string; extra?: { label: string; clearKey: string } }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const status = params.get("status") ?? "all";

  const push = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => (v === null || v === "" || v === "all" ? next.delete(k) : next.set(k, v)));
    start(() => router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`));
  };

  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => push({ q }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative sm:w-72">
        {pending ? <Loader2 className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />}
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="pl-8" aria-label="Search" />
      </div>
      {filters && (
        <div className="scrollbar-none flex gap-1 overflow-x-auto">
          {filters.map((f) => (
            <button key={f.value} onClick={() => push({ status: f.value })} aria-pressed={status === f.value}
              className={cn("h-8 shrink-0 rounded-md px-2.5 text-[13px] transition-colors", status === f.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
              {f.label}
            </button>
          ))}
        </div>
      )}
      {extra && params.get(extra.clearKey) && (
        <button onClick={() => push({ [extra.clearKey]: null })} className="flex h-8 items-center gap-1 rounded-md border px-2.5 text-[13px]">{extra.label}<X className="size-3.5" /></button>
      )}
    </div>
  );
}
