import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { FileSignature, Plus } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { createAgreement } from "./actions";

export const metadata = { title: "Agreements" };

export default async function AgreementsPage() {
  const { supabase, workspace } = await requireWorkspace();
  const { data } = await supabase.from("agreement_templates").select("id, name, body, updated_at").eq("workspace_id", workspace.id).order("updated_at", { ascending: false });
  const newBtn = <form action={createAgreement}><Button type="submit"><Plus />New agreement</Button></form>;
  return (
    <>
      <PageHeader title="Agreements" description="Reusable contracts with merge fields. Insert them into any onboarding's e-signature step." actions={newBtn} />
      {!data?.length ? (
        <EmptyState icon={FileSignature} title="No agreements yet" description="Save your standard services agreement once and reuse it in every onboarding." action={newBtn} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((a) => (
            <Link key={a.id} href={`/agreements/${a.id}`}>
              <Card className="h-full p-4 transition-shadow hover:shadow-pop">
                <div className="flex items-center gap-2"><FileSignature className="size-4 text-muted-foreground" /><h3 className="truncate text-sm font-semibold">{a.name}</h3></div>
                <p className="mt-2 line-clamp-3 text-[13px] text-muted-foreground">{a.body}</p>
                <p className="mt-3 text-xs text-muted-foreground">Edited {formatDistanceToNowStrict(new Date(a.updated_at), { addSuffix: true })}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <p className="mt-6 max-w-2xl text-xs text-muted-foreground">Templates are a starting point, not legal advice. Have a qualified lawyer review agreements for your jurisdiction and services.</p>
    </>
  );
}
