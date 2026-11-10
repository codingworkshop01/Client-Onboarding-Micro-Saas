"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MERGE_FIELDS, renderMergeFields } from "@/lib/merge-fields";
import { deleteAgreement, saveAgreement } from "../actions";

export function AgreementEditor({ id, initialName, initialBody, workspaceName }: { id: string; initialName: string; initialBody: string; workspaceName: string }) {
  const [name, setName] = useState(initialName);
  const [body, setBody] = useState(initialBody);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (key: string) => {
    const el = ref.current!;
    const t = `{{${key}}}`;
    const s = el.selectionStart, e = el.selectionEnd;
    setBody(body.slice(0, s) + t + body.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + t.length, s + t.length); });
  };
  const preview = renderMergeFields(body, { client: { name: "Jordan Lee", email: "jordan@acme.co", company: "Acme Co.", phone: "+1 555 0100" }, workspace: { name: workspaceName }, request: { title: "Website onboarding" } });

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/agreements" className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Agreements</Link>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10 text-base font-semibold" aria-label="Agreement name" />
        <div className="flex gap-2">
          <Button variant="outline" size="icon" aria-label="Delete agreement" onClick={() => { if (confirm("Delete this agreement? Onboardings that already use it keep their copy.")) start(() => deleteAgreement(id)); }}><Trash2 /></Button>
          <Button loading={pending} onClick={() => start(async () => { const r = await saveAgreement(id, { name, body }); if (r.ok) toast.success("Saved"); else toast.error(r.error); })}>Save</Button>
        </div>
      </div>
      <Tabs defaultValue="edit">
        <TabsList className="mb-4"><TabsTrigger value="edit">Edit</TabsTrigger><TabsTrigger value="preview">Preview</TabsTrigger></TabsList>
        <TabsContent value="edit">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {MERGE_FIELDS.map((m) => <button key={m.key} type="button" onClick={() => insert(m.key)} title={m.label} className="rounded-md border bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground">{`{{${m.key}}}`}</button>)}
          </div>
          <Textarea ref={ref} value={body} onChange={(e) => setBody(e.target.value)} rows={24} className="font-mono text-[13px] leading-relaxed" />
        </TabsContent>
        <TabsContent value="preview">
          <div className="prose-agreement rounded-xl border bg-card p-6 shadow-card">{preview}</div>
          <p className="mt-2 text-xs text-muted-foreground">Preview uses sample client details.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
