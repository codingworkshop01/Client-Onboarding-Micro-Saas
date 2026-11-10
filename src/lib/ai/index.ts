import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { env, features } from "@/lib/env";
import { ACCESS_PLATFORMS, FILE_CATEGORIES, FIELD_TYPES, stepsSchema, type Field, type Step } from "@/lib/flows/schema";
import { uid } from "@/lib/utils";

/**
 * AI features. Everything here returns DRAFTS for a human to review — nothing
 * in this module sends email, approves submissions or changes client data.
 * Provider is Anthropic Claude; swap `client()` for another provider later.
 */

export class AiNotConfiguredError extends Error {
  constructor() { super("AI is not configured. Add ANTHROPIC_API_KEY to enable it."); }
}

let _client: Anthropic | null = null;
function client() {
  if (!features.ai()) throw new AiNotConfiguredError();
  _client ??= new Anthropic({ apiKey: env.anthropicApiKey });
  return _client;
}

// Server-side refusal fallback (routes declined requests to a fallback model automatically).
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

async function structured<T extends z.ZodType>(schema: T, system: string, user: string, effort: "low" | "medium" | "high" = "medium"): Promise<z.infer<T>> {
  const res = await client().beta.messages.parse({
    model: env.aiModel,
    max_tokens: 16000,
    ...FALLBACK,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { effort, format: betaZodOutputFormat(schema) },
  });
  if (res.stop_reason === "refusal") throw new Error("The AI declined this request. Try rephrasing the input.");
  if (res.stop_reason === "max_tokens") throw new Error("The AI response was too long. Try a shorter input.");
  if (!res.parsed_output) throw new Error("The AI returned an unexpected format. Please try again.");
  return res.parsed_output;
}

async function text(system: string, user: string, effort: "low" | "medium" = "low") {
  const res = await client().beta.messages.create({
    model: env.aiModel,
    max_tokens: 16000,
    ...FALLBACK,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { effort },
  });
  if (res.stop_reason === "refusal") throw new Error("The AI declined this request.");
  return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
}

// ------------------------------------------------------ request builder ----
// A deliberately flat schema (every property required, nullable when not
// applicable) that is easy for structured outputs; converted to Steps below.
const draftSchema = z.object({
  name: z.string(),
  description: z.string(),
  summary_for_agency: z.string(),
  steps: z.array(z.object({
    type: z.enum(["form", "files", "access", "agreement", "payment"]),
    title: z.string(),
    description: z.string(),
    required: z.boolean(),
    questions: z.array(z.object({
      label: z.string(),
      type: z.enum(FIELD_TYPES.filter((t) => t !== "file") as [Exclude<Field["type"], "file">, ...Exclude<Field["type"], "file">[]]),
      required: z.boolean(),
      help_text: z.string().nullable(),
      options: z.array(z.string()),
      show_if_question: z.string().nullable(),
      show_if_answer: z.string().nullable(),
    })),
    documents: z.array(z.object({
      label: z.string(),
      description: z.string().nullable(),
      required: z.boolean(),
      accept: z.array(z.enum(FILE_CATEGORIES)),
    })),
    platforms: z.array(z.object({
      platform: z.enum(ACCESS_PLATFORMS),
      custom_name: z.string().nullable(),
      extra_instructions: z.string().nullable(),
    })),
    agreement_title: z.string().nullable(),
    agreement_body: z.string().nullable(),
    payment_amount: z.number().nullable(),
    payment_currency: z.string().nullable(),
    payment_kind: z.enum(["deposit", "initial", "full"]).nullable(),
    payment_description: z.string().nullable(),
  })),
});

const BUILDER_SYSTEM = `You design client onboarding flows for agencies and freelancers. Given a proposal, scope of work or client email, produce the onboarding a client must complete before work starts.

Rules:
- 3 to 7 steps. Order: questions first, then file uploads, then account access, then agreement, then payment.
- Only include steps the input justifies. Include a payment step only if the input mentions a fee, deposit or price; use the amount stated (in major currency units, e.g. 1500 for $1,500). Include an agreement step when there is a paid engagement.
- Questions: specific to this project, never generic filler. Ask only for information the agency doesn't already have from the input. Prefer choice fields when answers are predictable. Use show_if_question (exact label of an EARLIER question) and show_if_answer for follow-ups. Use "options" only for select/radio/checkbox (2-8 options), otherwise [].
- Documents: assets the work needs (logos, brand guides, content, credentials are NOT documents).
- Account access: only platforms the work needs. Never ask for passwords anywhere.
- Agreement body: plain text, numbered sections, professional and concise. Use merge fields {{client.name}}, {{client.company}}, {{workspace.name}}, {{date}}. Reflect the scope, fees and timeline from the input. Do not claim legal compliance.
- For fields that don't apply to a step type, use [] or null.
- summary_for_agency: 1-2 sentences explaining the flow you designed.`;

export async function generateFlowDraft(input: string, context?: { agencyName?: string }) {
  const draft = await structured(
    draftSchema,
    BUILDER_SYSTEM,
    `Agency: ${context?.agencyName ?? "the agency"}\n\n<input>\n${input}\n</input>`,
    "medium",
  );
  return { ...draftToTemplate(draft), summary: draft.summary_for_agency };
}

function draftToTemplate(d: z.infer<typeof draftSchema>) {
  const steps: Step[] = d.steps.map((s) => {
    const base = { id: uid("s_"), title: s.title.slice(0, 160) || "Step", description: s.description || undefined, required: s.required };
    switch (s.type) {
      case "form": {
        const fields: Field[] = [];
        for (const q of s.questions) {
          const hasOptions = q.type === "select" || q.type === "radio" || q.type === "checkbox";
          const f: Field = {
            id: uid("f_"),
            type: hasOptions && q.options.length < 2 ? "text" : q.type,
            label: q.label.slice(0, 300),
            required: q.required,
            description: q.help_text ?? undefined,
            options: hasOptions && q.options.length >= 2 ? q.options.slice(0, 20).map((o) => ({ id: uid("o_"), label: o.slice(0, 120) })) : undefined,
          };
          const parent = q.show_if_question ? fields.find((p) => p.label.trim().toLowerCase() === q.show_if_question!.trim().toLowerCase()) : undefined;
          if (parent) f.condition = { fieldId: parent.id, operator: q.show_if_answer ? "equals" : "is_filled", value: q.show_if_answer ?? undefined };
          fields.push(f);
        }
        return { ...base, type: "form", config: { fields } };
      }
      case "files":
        return { ...base, type: "files", config: { items: (s.documents.length ? s.documents : [{ label: "Files", description: null, required: false, accept: ["any" as const] }]).map((doc) => ({ id: uid("d_"), label: doc.label, description: doc.description ?? undefined, required: doc.required, accept: doc.accept.length ? doc.accept : ["any"], maxSizeMb: 25, multiple: true })) } };
      case "access":
        return { ...base, type: "access", config: { items: (s.platforms.length ? s.platforms : [{ platform: "other" as const, custom_name: "Platform", extra_instructions: null }]).map((p) => ({ id: uid("a_"), platform: p.platform, label: p.custom_name ?? undefined, instructions: p.extra_instructions ?? undefined, required: true })) } };
      case "agreement":
        return { ...base, type: "agreement", config: { agreementTitle: s.agreement_title || "Services Agreement", body: s.agreement_body || "This agreement is between {{workspace.name}} and {{client.company}}." } };
      case "payment":
        return { ...base, type: "payment", config: { amountCents: Math.max(50, Math.round((s.payment_amount ?? 500) * 100)), currency: (s.payment_currency ?? "usd").toLowerCase().slice(0, 3), kind: s.payment_kind ?? "deposit", description: s.payment_description ?? undefined } };
    }
  });
  const parsed = stepsSchema.safeParse(steps);
  if (!parsed.success) throw new Error("The AI draft didn't pass validation. Please try again.");
  return { name: d.name.slice(0, 120) || "AI onboarding", description: d.description.slice(0, 1000), steps: parsed.data };
}

// ----------------------------------------------- submissions analysis ----
export type QA = { step: string; question: string; answer: string };

export async function summarizeSubmission(input: { client: string; title: string; qa: QA[]; extras: string[] }) {
  return text(
    "You summarise client onboarding submissions for an agency team. Write a concise brief in plain text with short headings and bullet points: Key facts, Goals, Constraints & risks, Open questions. Only use what the client provided; never invent details. Under 250 words.",
    `Client: ${input.client}\nOnboarding: ${input.title}\n\n${formatQa(input.qa)}\n\nOther status:\n${input.extras.join("\n")}`,
    "low",
  );
}

export async function kickoffBrief(input: { client: string; title: string; qa: QA[]; extras: string[]; agency: string }) {
  return text(
    "You write project kickoff briefs for agencies, from completed client onboarding data. Plain text with headings: Project overview, Client goals, Scope & deliverables, Assets received, Access granted, Commercials, Risks & dependencies, Suggested first-week plan, Questions for the kickoff call. Bullet points. Only use the data given; mark gaps explicitly as 'Not provided'. Under 450 words.",
    `Agency: ${input.agency}\nClient: ${input.client}\nOnboarding: ${input.title}\n\n${formatQa(input.qa)}\n\nStatus:\n${input.extras.join("\n")}`,
    "medium",
  );
}

const vagueSchema = z.object({
  issues: z.array(z.object({
    question: z.string(),
    answer: z.string(),
    problem: z.string(),
    follow_up_question: z.string(),
  })),
});

export async function detectVagueAnswers(qa: QA[]) {
  const r = await structured(
    vagueSchema,
    "You review client onboarding answers and flag only answers that are incomplete, vague, contradictory or unusable for the agency to start work (e.g. 'idk', 'the usual', 'see email', a URL that is clearly not a website). Do not flag reasonable short answers. For each issue write a polite, specific follow-up question the agency could send. Return an empty list if everything is fine.",
    formatQa(qa),
    "low",
  );
  return r.issues;
}

export async function draftReminder(input: { client: string; agency: string; title: string; remaining: string[]; daysSinceSent: number | null; dueDate: string | null }) {
  return text(
    "You write short, warm, professional reminder emails from an agency to a client who hasn't finished their onboarding checklist. 2-4 sentences, no subject line, no greeting line (it's added automatically), no sign-off, no links (a button is added). Mention what's left specifically. Never guilt-trip.",
    `Agency: ${input.agency}\nClient: ${input.client}\nOnboarding: ${input.title}\nRemaining: ${input.remaining.join("; ")}\nDays since sent: ${input.daysSinceSent ?? "unknown"}\nDue: ${input.dueDate ?? "no due date"}`,
    "low",
  );
}

function formatQa(qa: QA[]) {
  if (!qa.length) return "(no answers yet)";
  return qa.map((q) => `[${q.step}] ${q.question}\n→ ${q.answer || "(blank)"}`).join("\n\n");
}
