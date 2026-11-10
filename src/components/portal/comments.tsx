"use client";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { PortalAdapter, PortalComment, PortalData } from "./types";

export function CommentsPanel({ open, onOpenChange, data, adapter }: { open: boolean; onOpenChange: (o: boolean) => void; data: PortalData; adapter: PortalAdapter }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<PortalComment[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const comments = [...data.comments, ...local.filter((l) => !data.comments.some((c) => c.id === l.id))];

  useEffect(() => { if (open) setTimeout(() => endRef.current?.scrollIntoView(), 50); }, [open, comments.length]);

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    const r = await adapter.postComment(text);
    setSending(false);
    if (!r.ok) return setError(r.error);
    setLocal((l) => [...l, r.comment]);
    setBody("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Questions and comments" className="max-w-md">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Questions?</h2>
          <p className="text-[13px] text-muted-foreground">Message {data.workspace.name} directly. We&apos;ll reply here and by email.</p>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {comments.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Ask anything about your onboarding.</p>}
          {comments.map((c) => (
            <div key={c.id} className={cn("flex gap-2.5", c.authorType === "client" && "flex-row-reverse")}>
              <Avatar name={c.authorName} className="size-7" />
              <div className={cn("max-w-[80%] rounded-xl px-3 py-2 text-sm", c.authorType === "client" ? "bg-brand text-brand-foreground" : "bg-muted")}>
                <div className="whitespace-pre-wrap">{c.body}</div>
                <div className={cn("mt-1 text-[11px]", c.authorType === "client" ? "opacity-75" : "text-muted-foreground")}>{c.authorName} · {new Date(c.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="border-t p-4">
          {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
          <div className="flex items-end gap-2">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Type your question…" className="min-h-11" maxLength={4000}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }} />
            <Button variant="brand" size="icon" onClick={send} loading={sending} aria-label="Send message">{!sending && <Send />}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
