"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { markCommentsRead, postAgencyComment } from "../actions";

type C = { id: string; authorType: "client" | "member" | "system"; authorName: string; body: string; createdAt: string };

export function CommentsThread({ requestId, comments, unread }: { requestId: string; comments: C[]; unread: number }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => { if (unread > 0) markCommentsRead(requestId); }, [requestId, unread]);

  return (
    <div className="grid gap-4">
      {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet. Your client can ask questions from their onboarding page. Replies are emailed to them.</p>}
      <div className="grid gap-4">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar name={c.authorName} className="size-8" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 text-sm">
                <span className="font-medium">{c.authorName}</span>
                <span className={cn("text-xs", c.authorType === "client" ? "text-info" : "text-muted-foreground")}>{c.authorType === "client" ? "Client" : "Team"}</span>
                <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              </div>
              <p className="mt-0.5 text-sm whitespace-pre-wrap">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border bg-card p-2 shadow-xs">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Reply to your client…" className="border-0 shadow-none focus-visible:ring-0" maxLength={4000} />
        <div className="flex justify-end">
          <Button size="sm" loading={pending} disabled={!body.trim()} onClick={() => start(async () => { const r = await postAgencyComment(requestId, body); if (!r.ok) return void toast.error(r.error); setBody(""); router.refresh(); })}><Send />Send reply</Button>
        </div>
      </div>
    </div>
  );
}
