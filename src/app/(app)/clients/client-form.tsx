"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { saveClient } from "./actions";

type V = { name: string; email: string; company: string; phone: string; website: string };

export function ClientDialog({ client }: { client?: V & { id: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<V>({ defaultValues: client ?? { name: "", email: "", company: "", phone: "", website: "" } });
  const submit = handleSubmit(async (v) => {
    const r = await saveClient(client?.id ?? null, v);
    if (!r.ok) {
      Object.entries(r.fieldErrors ?? {}).forEach(([k, m]) => m?.[0] && setError(k as keyof V, { message: m[0] }));
      if (!r.fieldErrors) toast.error(r.error);
      return;
    }
    toast.success(client ? "Client updated" : "Client added");
    setOpen(false);
    if (client) router.refresh(); else router.push(`/clients/${r.id}`);
  });
  return (
    <>
      {client ? <Button variant="outline" onClick={() => setOpen(true)}><Pencil />Edit</Button> : <Button onClick={() => setOpen(true)}><Plus />Add client</Button>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{client ? "Edit client" : "Add client"}</DialogTitle><DialogDescription>Contact details used in onboarding emails and agreements.</DialogDescription></DialogHeader>
          <form onSubmit={submit} className="grid gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact name" htmlFor="c-name" error={errors.name?.message} required><Input id="c-name" {...register("name", { required: "Name is required" })} /></Field>
              <Field label="Email" htmlFor="c-email" error={errors.email?.message} required><Input id="c-email" type="email" {...register("email", { required: "Email is required" })} /></Field>
              <Field label="Company" htmlFor="c-company" optionalHint><Input id="c-company" {...register("company")} /></Field>
              <Field label="Phone" htmlFor="c-phone" optionalHint><Input id="c-phone" type="tel" {...register("phone")} /></Field>
            </div>
            <Field label="Website" htmlFor="c-web" optionalHint><Input id="c-web" {...register("website")} placeholder="https://" /></Field>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={isSubmitting}>{client ? "Save" : "Add client"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
