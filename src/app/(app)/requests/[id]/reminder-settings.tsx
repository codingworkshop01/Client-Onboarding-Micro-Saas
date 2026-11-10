"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { BellRing } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateRequestSettings, sendManualReminder } from "../actions";

export function ReminderSettings({ id, active, enabled, intervalDays, maxReminders, sent, nextAt, dueDate }: {
  id: string; active: boolean; enabled: boolean; intervalDays: number; maxReminders: number; sent: number; nextAt: string | null; dueDate: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState({ enabled, intervalDays, maxReminders, dueDate });
  const dirty = state.enabled !== enabled || state.intervalDays !== intervalDays || state.maxReminders !== maxReminders || state.dueDate !== dueDate;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Reminders</h3>
        <Switch checked={state.enabled} onCheckedChange={(v) => setState((s) => ({ ...s, enabled: v }))} aria-label="Automatic reminders" />
      </div>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Select value={String(state.intervalDays)} onValueChange={(v) => setState((s) => ({ ...s, intervalDays: Number(v) }))} disabled={!state.enabled}>
            <SelectTrigger aria-label="Interval"><SelectValue /></SelectTrigger>
            <SelectContent>{[1, 2, 3, 5, 7, 14].map((d) => <SelectItem key={d} value={String(d)}>Every {d === 1 ? "day" : `${d} days`}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(state.maxReminders)} onValueChange={(v) => setState((s) => ({ ...s, maxReminders: Number(v) }))} disabled={!state.enabled}>
            <SelectTrigger aria-label="Maximum reminders"><SelectValue /></SelectTrigger>
            <SelectContent>{[1, 2, 3, 4, 6, 8, 10].map((d) => <SelectItem key={d} value={String(d)}>Max {d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <label className="grid gap-1 text-[13px] text-muted-foreground">Due date
          <Input type="date" value={state.dueDate ?? ""} onChange={(e) => setState((s) => ({ ...s, dueDate: e.target.value || null }))} />
        </label>
        <p className="text-xs text-muted-foreground">
          {sent} sent{active && enabled && nextAt ? ` · next ${format(new Date(nextAt), "MMM d, h:mm a")}` : !active ? " · stopped (not active)" : ""}
        </p>
        {dirty && <Button size="sm" loading={pending} onClick={() => start(async () => { await updateRequestSettings(id, state); toast.success("Saved"); router.refresh(); })}>Save</Button>}
        {active && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
            const r = await sendManualReminder(id);
            if (!r.ok) return void toast.error(r.error);
            if (r.status === "sent") toast.success("Reminder sent"); else toast.warning(`Reminder not sent (${r.status}${r.error ? `: ${r.error}` : ""})`);
            router.refresh();
          })}><BellRing />Send reminder now</Button>
        )}
      </div>
    </Card>
  );
}
