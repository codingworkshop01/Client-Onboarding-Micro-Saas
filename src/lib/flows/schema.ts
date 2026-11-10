import { z } from "zod";

/**
 * The onboarding flow domain model. Flow templates store `steps` as JSON that
 * must match `stepsSchema`; requests snapshot the same structure into
 * request_steps.config. This file is shared by server and browser code.
 */

// ---------------------------------------------------------------- fields ----
export const FIELD_TYPES = [
  "text",
  "textarea",
  "email",
  "phone",
  "number",
  "url",
  "date",
  "select",
  "radio",
  "checkbox",
  "file",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Short text",
  textarea: "Long text",
  email: "Email",
  phone: "Phone",
  number: "Number",
  url: "Website / URL",
  date: "Date",
  select: "Dropdown",
  radio: "Single choice",
  checkbox: "Multiple choice",
  file: "File upload",
};

export const CONDITION_OPERATORS = ["equals", "not_equals", "contains", "is_filled", "is_empty"] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export const conditionSchema = z.object({
  fieldId: z.string().min(1),
  operator: z.enum(CONDITION_OPERATORS),
  value: z.string().max(200).optional(),
});
export type Condition = z.infer<typeof conditionSchema>;

export const optionSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1, "Option label is required").max(120),
});

export const FILE_CATEGORIES = ["any", "pdf", "images", "documents", "spreadsheets", "presentations", "video", "audio", "archives", "design"] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  any: "Any file",
  pdf: "PDF",
  images: "Images",
  documents: "Documents (Word, text)",
  spreadsheets: "Spreadsheets",
  presentations: "Presentations",
  video: "Video",
  audio: "Audio",
  archives: "ZIP archives",
  design: "Design files (AI, PSD, Figma, SVG)",
};

export const fieldSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(FIELD_TYPES),
  label: z.string().trim().min(1, "Question is required").max(300),
  description: z.string().max(1000).optional(),
  placeholder: z.string().max(200).optional(),
  required: z.boolean().default(false),
  options: z.array(optionSchema).max(50).optional(),
  condition: conditionSchema.optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  accept: z.array(z.enum(FILE_CATEGORIES)).optional(),
  maxSizeMb: z.number().int().min(1).max(50).optional(),
});
export type Field = z.infer<typeof fieldSchema>;

// ----------------------------------------------------------------- steps ----
export const STEP_TYPES = ["form", "files", "access", "agreement", "payment"] as const;
export type StepType = (typeof STEP_TYPES)[number];

export const STEP_TYPE_META: Record<StepType, { label: string; description: string }> = {
  form: { label: "Questions & form", description: "Ask questions with a smart form" },
  files: { label: "File uploads", description: "Request documents and assets" },
  access: { label: "Account access", description: "Guide clients to grant platform access" },
  agreement: { label: "Agreement & e-signature", description: "Have the client read and sign" },
  payment: { label: "Payment", description: "Collect a deposit or initial payment" },
};

export const fileItemSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1, "Document name is required").max(200),
  description: z.string().max(1000).optional(),
  required: z.boolean().default(true),
  accept: z.array(z.enum(FILE_CATEGORIES)).min(1).default(["any"]),
  maxSizeMb: z.number().int().min(1).max(50).default(25),
  multiple: z.boolean().default(true),
});
export type FileItem = z.infer<typeof fileItemSchema>;

export const ACCESS_PLATFORMS = [
  "meta_business",
  "facebook_page",
  "google_analytics",
  "google_ads",
  "google_search_console",
  "wordpress",
  "shopify",
  "hosting_domain",
  "other",
] as const;
export type AccessPlatform = (typeof ACCESS_PLATFORMS)[number];

export const accessItemSchema = z.object({
  id: z.string().min(1).max(40),
  platform: z.enum(ACCESS_PLATFORMS),
  label: z.string().trim().max(200).optional(),
  instructions: z.string().max(4000).optional(),
  videoUrl: z.string().url().max(500).optional().or(z.literal("")),
  required: z.boolean().default(true),
});
export type AccessItem = z.infer<typeof accessItemSchema>;

const baseStep = {
  id: z.string().min(1).max(40),
  title: z.string().trim().min(1, "Step title is required").max(160),
  description: z.string().max(2000).optional(),
  required: z.boolean().default(true),
};

export const formStepSchema = z.object({
  ...baseStep,
  type: z.literal("form"),
  config: z.object({ fields: z.array(fieldSchema).max(100) }),
});
export const filesStepSchema = z.object({
  ...baseStep,
  type: z.literal("files"),
  config: z.object({ items: z.array(fileItemSchema).min(1, "Add at least one document").max(50) }),
});
export const accessStepSchema = z.object({
  ...baseStep,
  type: z.literal("access"),
  config: z.object({
    grantToEmail: z.string().max(254).optional(),
    items: z.array(accessItemSchema).min(1, "Add at least one platform").max(20),
  }),
});
export const agreementStepSchema = z.object({
  ...baseStep,
  type: z.literal("agreement"),
  config: z.object({
    agreementTitle: z.string().trim().min(1).max(200),
    body: z.string().min(1, "Agreement text is required").max(100_000),
    agreementTemplateId: z.string().uuid().optional(),
  }),
});
export const paymentStepSchema = z.object({
  ...baseStep,
  type: z.literal("payment"),
  config: z.object({
    amountCents: z.number().int().min(50, "Minimum amount is 0.50").max(100_000_000),
    currency: z.string().length(3).default("usd"),
    description: z.string().max(500).optional(),
    kind: z.enum(["deposit", "full", "initial"]).default("deposit"),
  }),
});

export const stepSchema = z.discriminatedUnion("type", [
  formStepSchema,
  filesStepSchema,
  accessStepSchema,
  agreementStepSchema,
  paymentStepSchema,
]);
export type Step = z.infer<typeof stepSchema>;
export type FormStep = z.infer<typeof formStepSchema>;
export type FilesStep = z.infer<typeof filesStepSchema>;
export type AccessStep = z.infer<typeof accessStepSchema>;
export type AgreementStep = z.infer<typeof agreementStepSchema>;
export type PaymentStep = z.infer<typeof paymentStepSchema>;

export const stepsSchema = z.array(stepSchema).max(30, "A flow can have at most 30 steps");

export const templateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().max(1000).optional(),
  category: z.string().max(60).optional(),
  steps: stepsSchema,
});
export type TemplateInput = z.infer<typeof templateSchema>;

// ------------------------------------------------- per-step client data ----
export type AnswerValue = string | string[] | number | boolean | null;
export type FormStepData = { answers?: Record<string, AnswerValue> };
export type AccessStepData = {
  confirmations?: Record<string, { confirmed: boolean; at: string; note?: string }>;
};
