import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/auth";
import { AgreementEditor } from "./editor";

export const metadata = { title: "Edit agreement" };

export default async function AgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, workspace } = await requireWorkspace();
  const { data } = await supabase.from("agreement_templates").select("*").eq("id", id).eq("workspace_id", workspace.id).maybeSingle();
  if (!data) notFound();
  return <AgreementEditor id={data.id} initialName={data.name} initialBody={data.body} workspaceName={workspace.name} />;
}
