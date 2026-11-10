"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog as D } from "radix-ui";
import { FileText, LayoutDashboard, LayoutTemplate, Plus, Send, Settings, Sparkles, User, Users } from "lucide-react";
import { globalSearch, type SearchHit } from "@/app/(app)/actions";

const ICONS = { client: User, request: Send, template: LayoutTemplate };

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    if (query.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(() => { globalSearch(query).then(setHits).catch(() => setHits([])); }, 180);
    return () => clearTimeout(t);
  }, [query]);

  const go = (href: string) => { onOpenChange(false); setQuery(""); router.push(href); };
  const item = "flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-2 text-sm aria-selected:bg-accent [&_svg]:size-4 [&_svg]:text-muted-foreground";

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <D.Content className="fixed top-[14vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border bg-popover shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]">
          <D.Title className="sr-only">Search</D.Title>
          <Command shouldFilter={false} loop>
            <Command.Input value={query} onValueChange={setQuery} placeholder="Search clients, onboardings, templates…" className="h-12 w-full border-b bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground" />
            <Command.List className="max-h-[50vh] overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">No results.</Command.Empty>
              {hits.length > 0 && (
                <Command.Group heading="Results" className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground">
                  {hits.map((h) => {
                    const Icon = ICONS[h.type];
                    return (
                      <Command.Item key={`${h.type}-${h.id}`} value={`${h.type}-${h.id}`} onSelect={() => go(h.href)} className={item}>
                        <Icon /><span className="truncate">{h.title}</span>
                        {h.subtitle && <span className="ml-auto truncate text-xs text-muted-foreground">{h.subtitle}</span>}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}
              {query.trim().length < 2 && (
                <Command.Group heading="Go to" className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground">
                  <Command.Item onSelect={() => go("/requests/new")} className={item}><Plus />New onboarding</Command.Item>
                  <Command.Item onSelect={() => go("/templates/ai")} className={item}><Sparkles />AI Request Builder</Command.Item>
                  <Command.Item onSelect={() => go("/dashboard")} className={item}><LayoutDashboard />Dashboard</Command.Item>
                  <Command.Item onSelect={() => go("/requests")} className={item}><Send />Onboardings</Command.Item>
                  <Command.Item onSelect={() => go("/clients")} className={item}><Users />Clients</Command.Item>
                  <Command.Item onSelect={() => go("/templates")} className={item}><LayoutTemplate />Templates</Command.Item>
                  <Command.Item onSelect={() => go("/agreements")} className={item}><FileText />Agreements</Command.Item>
                  <Command.Item onSelect={() => go("/settings")} className={item}><Settings />Settings</Command.Item>
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
