/** Render {{merge.fields}} in agreement text. Unknown fields are left visible. */
export type MergeContext = {
  client: { name: string; email: string; company?: string | null; phone?: string | null };
  workspace: { name: string };
  request: { title: string };
  date?: Date;
};

export const MERGE_FIELDS = [
  { key: "client.name", label: "Client name" },
  { key: "client.email", label: "Client email" },
  { key: "client.company", label: "Client company" },
  { key: "client.phone", label: "Client phone" },
  { key: "workspace.name", label: "Your business name" },
  { key: "request.title", label: "Onboarding title" },
  { key: "date", label: "Today's date" },
] as const;

export function renderMergeFields(body: string, ctx: MergeContext) {
  const date = (ctx.date ?? new Date()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const values: Record<string, string> = {
    "client.name": ctx.client.name,
    "client.email": ctx.client.email,
    "client.company": ctx.client.company || ctx.client.name,
    "client.phone": ctx.client.phone || "",
    "workspace.name": ctx.workspace.name,
    "request.title": ctx.request.title,
    date,
  };
  return body.replace(/\{\{\s*([a-z.]+)\s*\}\}/gi, (match, key: string) => values[key] ?? match);
}
