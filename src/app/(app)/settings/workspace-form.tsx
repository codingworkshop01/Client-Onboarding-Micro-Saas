"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { ImageUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { readableOn, slugify } from "@/lib/utils";
import { setLogoUrl, updateProfileName, updateWorkspace } from "./actions";

type V = { name: string; slug: string; brandColor: string; supportEmail: string; website: string; welcomeMessage: string; reminderIntervalDays: number; maxReminders: number };

export function WorkspaceSettingsForm({ initial, logoUrl, workspaceId, canEdit, profileName }: { initial: V; logoUrl: string | null; workspaceId: string; canEdit: boolean; profileName: string }) {
  const router = useRouter();
  const { register, control, handleSubmit, watch, setError, formState: { errors, isSubmitting, isDirty }, reset } = useForm<V>({ defaultValues: initial });
  const color = watch("brandColor");
  const name = watch("name");
  const [logo, setLogo] = useState(logoUrl);
  const [uploading, setUploading] = useState(false);
  const [myName, setMyName] = useState(profileName);
  const [savingName, startName] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = handleSubmit(async (v) => {
    const r = await updateWorkspace({ ...v, slug: slugify(v.slug) });
    if (!r.ok) {
      Object.entries(r.fieldErrors ?? {}).forEach(([k, m]) => m?.[0] && setError(k as keyof V, { message: m[0] }));
      return void toast.error(r.error);
    }
    toast.success("Settings saved");
    reset(v);
    router.refresh();
  });

  const uploadLogo = async (file: File) => {
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) return void toast.error("Use a PNG, JPG, WebP or SVG image");
    if (file.size > 2 * 1024 * 1024) return void toast.error("Logo must be under 2 MB");
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z]/g, "") || "png";
    const path = `${workspaceId}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("branding").upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setUploading(false); return void toast.error("Upload failed. Only owners and admins can change the logo."); }
    const { data } = supabase.storage.from("branding").getPublicUrl(path);
    const r = await setLogoUrl(data.publicUrl);
    setUploading(false);
    if (!r.ok) return void toast.error(r.error);
    setLogo(data.publicUrl);
    toast.success("Logo updated");
    router.refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <form onSubmit={submit} className="grid content-start gap-6" noValidate>
        <fieldset disabled={!canEdit} className="grid gap-6">
          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 text-[15px] font-semibold">Brand</h2>
            <div className="grid gap-5">
              <Field label="Logo" description="Shown on your client portal and emails. PNG, JPG, WebP or SVG, up to 2 MB.">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-28 items-center justify-center rounded-lg border bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {logo ? <img src={logo} alt="Logo" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">No logo</span>}
                  </div>
                  <Button type="button" variant="outline" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}><ImageUp />Upload</Button>
                  {logo && <Button type="button" variant="ghost" size="sm" onClick={async () => { await setLogoUrl(null); setLogo(null); router.refresh(); }}><Trash2 />Remove</Button>}
                  <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }} />
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Business name" htmlFor="ws-name" error={errors.name?.message}><Input id="ws-name" {...register("name")} /></Field>
                <Field label="Brand color" htmlFor="ws-color" error={errors.brandColor?.message}>
                  <div className="flex gap-2">
                    <Controller control={control} name="brandColor" render={({ field }) => (
                      <input type="color" aria-label="Pick brand color" value={field.value} onChange={(e) => field.onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border bg-background p-1" />
                    )} />
                    <Input id="ws-color" {...register("brandColor")} className="font-mono" />
                  </div>
                </Field>
              </div>
              <Field label="Welcome message" htmlFor="ws-welcome" optionalHint description="Shown at the top of every client portal (an onboarding's personal message overrides it).">
                <Textarea id="ws-welcome" rows={3} {...register("welcomeMessage")} placeholder="Welcome aboard! This checklist gives us everything we need to start." />
              </Field>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 text-[15px] font-semibold">Workspace</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Workspace URL" htmlFor="ws-slug" error={errors.slug?.message} description="Custom domains and subdomains come with the Scale plan."><Input id="ws-slug" {...register("slug")} /></Field>
              <Field label="Reply-to email" htmlFor="ws-email" error={errors.supportEmail?.message} description="Client replies to emails go here."><Input id="ws-email" type="email" {...register("supportEmail")} placeholder="hello@youragency.com" /></Field>
              <Field label="Website" htmlFor="ws-web" optionalHint><Input id="ws-web" {...register("website")} placeholder="https://" /></Field>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="mb-1 text-[15px] font-semibold">Default reminders</h2>
            <p className="mb-4 text-[13px] text-muted-foreground">Used for new onboardings. You can change them per onboarding.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Remind every">
                <Controller control={control} name="reminderIntervalDays" render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{[1, 2, 3, 5, 7, 14].map((d) => <SelectItem key={d} value={String(d)}>{d === 1 ? "Every day" : `Every ${d} days`}</SelectItem>)}</SelectContent></Select>
                )} />
              </Field>
              <Field label="Stop after">
                <Controller control={control} name="maxReminders" render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{[1, 2, 3, 4, 6, 8, 10].map((d) => <SelectItem key={d} value={String(d)}>{d} reminders</SelectItem>)}</SelectContent></Select>
                )} />
              </Field>
            </div>
          </Card>
        </fieldset>
        {canEdit ? (
          <div className="flex justify-end"><Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save changes</Button></div>
        ) : <p className="text-sm text-muted-foreground">Only owners and admins can edit workspace settings.</p>}

        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 text-[15px] font-semibold">Your profile</h2>
          <div className="flex gap-2">
            <Input value={myName} onChange={(e) => setMyName(e.target.value)} aria-label="Your name" className="max-w-xs" />
            <Button type="button" variant="outline" loading={savingName} onClick={() => startName(async () => { const r = await updateProfileName(myName); if (r.ok) { toast.success("Name updated"); router.refresh(); } else toast.error(r.error); })}>Save</Button>
          </div>
        </Card>
      </form>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Portal preview</p>
        <div className="overflow-hidden rounded-xl border bg-surface shadow-card">
          <div className="flex h-12 items-center gap-2 border-b bg-background px-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo ? <img src={logo} alt="" className="h-6 max-w-[120px] object-contain" /> : <><span className="flex size-6 items-center justify-center rounded-md text-xs font-semibold" style={{ background: color, color: readableOn(color) }}>{name?.[0]}</span><span className="text-sm font-semibold">{name}</span></>}
          </div>
          <div className="p-4">
            <div className="text-xs text-muted-foreground">Hi Jordan 👋</div>
            <div className="mt-0.5 text-sm font-semibold">Website onboarding</div>
            <div className="mt-3 h-1.5 rounded-full bg-muted"><div className="h-full w-2/5 rounded-full" style={{ background: color }} /></div>
            <div className="mt-4 rounded-md px-3 py-2 text-center text-xs font-medium" style={{ background: color, color: readableOn(color) }}>Continue</div>
          </div>
        </div>
      </aside>
    </div>
  );
}
