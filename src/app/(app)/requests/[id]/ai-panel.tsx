"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, Copy, FileText, MailPlus, SearchCheck, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { aiCheckAnswers, aiDraftReminder, aiKickoffBrief, aiSummarize } from "../ai-actions";
import { sendManualReminder } from "../actions";

type Issue = { question: string; answer: string; problem: string; follow_up_question: string };

export function AiPanel({ id, enabled, status, summary, summaryAt, brief, briefAt }: {
  id: string; enabled: boolean; status: string; summary: string | null; summaryAt: string | null; brief: string | null; briefAt: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [, start] = useTransition();
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [view, setView] = useState<"summary" | "brief" | null>(null);

  const run = (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setPending(key);
    start(async () => {
      const r = await fn();
      setPending(null);
      if (!r.ok) return void toast.error(r.error);
      after?.();
      router.refresh();
    });
  };

  if (!enabled) {
    return (
      <Card className="p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase"><Sparkles className="size-3.5 text-[#7c3aed]" />AI assistant</h3>
        <p className="text-[13px] text-muted-foreground">Add an <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> to summarise answers, flag vague responses, draft reminders and generate kickoff briefs.</p>
      </Card>
    );
  }

  const active = status === "sent" || status === "in_progress";
  return (
    <Card className="p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase"><Sparkles className="size-3.5 text-[#7c3aed]" />AI assistant</h3>
      <div className="grid gap-1.5">
        <AiButton icon={FileText} label={summary ? "View answer summary" : "Summarise answers"} loading={pending === "summary"} onClick={() => summary ? setView("summary") : run("summary", () => aiSummarize(id), () => setView("summary"))} />
        <AiButton icon={SearchCheck} label="Check for vague answers" loading={pending === "vague"} onClick={() => run("vague", async () => { const r = await aiCheckAnswers(id); if (r.ok) setIssues(r.issues); return r; })} />
        {active && <AiButton icon={MailPlus} label="Draft a reminder" loading={pending === "reminder"} onClick={() => run("reminder", async () => { const r = await aiDraftReminder(id); if (r.ok) setDraft(r.draft); return r; })} />}
        {status === "completed" && <AiButton icon={Sparkles} label={brief ? "View kickoff brief" : "Generate kickoff brief"} loading={pending === "brief"} onClick={() => brief ? setView("brief") : run("brief", () => aiKickoffBrief(id), () => setView("brief"))} />}
      </div>
      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">AI output is a draft. Nothing is sent or approved without you.</p>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{view === "brief" ? "Kickoff brief" : "Answer summary"}</DialogTitle>
            <DialogDescription>Generated {formatDistanceToNowStrict(new Date((view === "brief" ? briefAt : summaryAt) ?? Date.now()), { addSuffix: true })}. Review before sharing.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-lg bg-surface p-4 text-sm leading-relaxed whitespace-pre-wrap">{view === "brief" ? brief : summary}</div>
          <DialogFooter>
            <Button variant="outline" loading={pending === view} onClick={() => run(view!, () => (view === "brief" ? aiKickoffBrief(id) : aiSummarize(id)))}>Regenerate</Button>
            <Button onClick={async () => { await navigator.clipboard.writeText((view === "brief" ? brief : summary) ?? ""); toast.success("Copied"); }}><Copy />Copy</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!issues} onOpenChange={(o) => !o && setIssues(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Answer check</DialogTitle>
            <DialogDescription>{issues?.length ? "These answers might need a follow-up. Copy a question into a comment if you agree." : "No vague or incomplete answers found."}</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto">
            {issues?.map((i, n) => (
              <div key={n} className="rounded-lg border p-3 text-sm">
                <div className="font-medium">{i.question}</div>
                <div className="mt-0.5 text-muted-foreground">“{i.answer || "blank"}”</div>
                <div className="mt-2 flex gap-1.5 text-[13px] text-warning"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{i.problem}</div>
                <div className="mt-2 flex items-start justify-between gap-2 rounded-md bg-muted/60 p-2 text-[13px]">
                  <span>{i.follow_up_question}</span>
                  <Button variant="ghost" size="icon-sm" aria-label="Copy follow-up" onClick={async () => { await navigator.clipboard.writeText(i.follow_up_question); toast.success("Copied"); }}><Copy /></Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reminder draft</DialogTitle>
            <DialogDescription>Edit it, then send. A greeting and a “Continue” button are added automatically.</DialogDescription>
          </DialogHeader>
          <Textarea rows={6} value={draft ?? ""} onChange={(e) => setDraft(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Discard</Button>
            <Button loading={pending === "send"} disabled={!draft?.trim()} onClick={() => { setPending("send"); start(async () => {
              const r = await sendManualReminder(id, draft);
              setPending(null);
              if (!r.ok) return void toast.error(r.error);
              if (r.status === "sent") toast.success("Reminder sent"); else toast.warning(`Not sent (${r.status}${r.error ? `: ${r.error}` : ""})`);
              setDraft(null); router.refresh();
            }); }}>Send reminder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AiButton({ icon: Icon, label, loading, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; loading: boolean; onClick: () => void }) {
  return <Button variant="ghost" size="sm" className="justify-start" loading={loading} onClick={onClick}>{!loading && <Icon className="text-muted-foreground" />}{label}</Button>;
}
