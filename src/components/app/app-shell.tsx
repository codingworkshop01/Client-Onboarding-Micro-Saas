"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTheme } from "next-themes";
import {
  LayoutDashboard, Send, Users, LayoutTemplate, FileSignature, Settings, Plus, Search, ChevronsUpDown, Check, LogOut, Moon, Sun, Menu, Sparkles, Monitor,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { switchWorkspace } from "@/app/(app)/actions";
import { CommandPalette } from "./command-palette";
import { LogoMark } from "./logo";

type WS = { id: string; name: string; logoUrl: string | null; brandColor: string };

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/requests", label: "Onboardings", icon: Send },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/agreements", label: "Agreements", icon: FileSignature },
];

export function AppShell({ children, workspace, workspaces, user, role, unreadComments }: {
  children: React.ReactNode;
  workspace: WS & { plan: string };
  workspaces: WS[];
  user: { name: string; email: string };
  role: string;
  unreadComments: number;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sidebar = (
    <SidebarContent workspace={workspace} workspaces={workspaces} user={user} role={role} unreadComments={unreadComments} onSearch={() => setPaletteOpen(true)} />
  );

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r bg-sidebar lg:block">{sidebar}</aside>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur lg:hidden">
        <Button variant="ghost" size="icon-sm" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu /></Button>
        <span className="truncate text-sm font-semibold">{workspace.name}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setPaletteOpen(true)} aria-label="Search"><Search /></Button>
          <Button size="sm" asChild><Link href="/requests/new"><Plus />New</Link></Button>
        </div>
      </header>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" title="Navigation" className="bg-sidebar p-0">{sidebar}</SheetContent>
      </Sheet>
      <main className="min-w-0">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</div>
      </main>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

function SidebarContent({ workspace, workspaces, user, role, unreadComments, onSearch }: {
  workspace: WS & { plan: string }; workspaces: WS[]; user: { name: string; email: string }; role: string; unreadComments: number; onSearch: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/30">
            <WorkspaceIcon ws={workspace} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{workspace.name}</span>
              <span className="block text-xs text-muted-foreground capitalize">{workspace.plan} plan</span>
            </span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60" align="start">
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {workspaces.map((w) => (
              <DropdownMenuItem key={w.id} disabled={pending} onSelect={() => start(async () => { await switchWorkspace(w.id); router.refresh(); })}>
                <WorkspaceIcon ws={w} small />
                <span className="flex-1 truncate">{w.name}</span>
                {w.id === workspace.id && <Check className="!text-foreground" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/onboarding"><Plus />Create workspace</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="px-3">
        <button onClick={onSearch} className="flex h-8 w-full items-center gap-2 rounded-md border bg-background px-2.5 text-sm text-muted-foreground shadow-xs transition hover:text-foreground">
          <Search className="size-3.5" />Search
          <kbd className="ml-auto rounded border bg-muted px-1 font-mono text-[10px]">⌘K</kbd>
        </button>
      </div>

      <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Main">
        <Button asChild className="mb-3 w-full justify-start" size="sm">
          <Link href="/requests/new"><Plus />New onboarding</Link>
        </Button>
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
              className={cn("group flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
                active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground")}>
              <item.icon className={cn("size-4", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} />
              {item.label}
              {item.href === "/requests" && unreadComments > 0 && (
                <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground tabular">{unreadComments}</span>
              )}
            </Link>
          );
        })}
        <Link href="/templates/ai" className={cn("group flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors", pathname === "/templates/ai" ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground")}>
          <Sparkles className="size-4 text-[#7c3aed]" />AI Request Builder
        </Link>
      </nav>

      <div className="border-t p-3">
        <Link href="/settings" className={cn("mb-1 flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors", pathname.startsWith("/settings") ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground")}>
          <Settings className="size-4" />Settings
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-none hover:bg-accent">
            <Avatar name={user.name} className="size-7" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start" side="top">
            <DropdownMenuLabel className="capitalize">{role}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setTheme("light")}><Sun />Light{theme === "light" && <Check className="ml-auto !text-foreground" />}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTheme("dark")}><Moon />Dark{theme === "dark" && <Check className="ml-auto !text-foreground" />}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTheme("system")}><Monitor />System{theme === "system" && <Check className="ml-auto !text-foreground" />}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action="/auth/signout" method="post">
              <button type="submit" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent [&_svg]:size-4 [&_svg]:text-muted-foreground"><LogOut />Sign out</button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function WorkspaceIcon({ ws, small }: { ws: WS; small?: boolean }) {
  const size = small ? "size-5 text-[10px] rounded" : "size-7 text-xs rounded-md";
  if (ws.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={ws.logoUrl} alt="" className={cn(size, "border bg-white object-contain")} />;
  }
  return <span className={cn(size, "flex shrink-0 items-center justify-center font-semibold text-white")} style={{ background: ws.brandColor }}>{ws.name[0]?.toUpperCase()}</span>;
}

export { LogoMark };
