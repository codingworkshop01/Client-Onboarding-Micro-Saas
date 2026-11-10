import type { AnswerValue, Condition, Field, FileCategory, Step } from "./schema";
import { uid } from "@/lib/utils";

/** Shared (client + server) conditional logic and validation. */

export function isEmpty(value: AnswerValue | undefined) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function asText(value: AnswerValue | undefined): string {
  if (Array.isArray(value)) return value.join(",");
  if (value === null || value === undefined) return "";
  return String(value);
}

export function evaluateCondition(condition: Condition, answers: Record<string, AnswerValue>, optionLabels?: Map<string, string>) {
  const raw = answers[condition.fieldId];
  const expected = (condition.value ?? "").trim().toLowerCase();
  // Choice fields store option ids; compare against both id and label.
  const values = (Array.isArray(raw) ? raw : [raw]).flatMap((v) => {
    const s = asText(v as AnswerValue).toLowerCase();
    const label = optionLabels?.get(asText(v as AnswerValue))?.toLowerCase();
    return label ? [s, label] : [s];
  });
  switch (condition.operator) {
    case "is_filled":
      return !isEmpty(raw);
    case "is_empty":
      return isEmpty(raw);
    case "equals":
      return values.some((v) => v === expected);
    case "not_equals":
      return !values.some((v) => v === expected);
    case "contains":
      return values.some((v) => v.includes(expected));
  }
}

/** Visible fields given current answers. Conditions may chain (A → B → C). */
export function visibleFields(fields: Field[], answers: Record<string, AnswerValue>) {
  const labels = new Map<string, string>();
  fields.forEach((f) => f.options?.forEach((o) => labels.set(o.id, o.label)));
  const visible = new Set<string>();
  for (const field of fields) {
    if (!field.condition) {
      visible.add(field.id);
      continue;
    }
    // A field depending on a hidden field is hidden too.
    if (!visible.has(field.condition.fieldId)) continue;
    if (evaluateCondition(field.condition, answers, labels)) visible.add(field.id);
  }
  return fields.filter((f) => visible.has(f.id));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\-.\s0-9]{6,24}$/;

export function validateField(field: Field, value: AnswerValue | undefined): string | null {
  if (field.type === "file") return null; // files are validated against the documents table
  if (isEmpty(value)) return field.required ? "This field is required" : null;
  const text = asText(value).trim();
  switch (field.type) {
    case "email":
      return EMAIL_RE.test(text) ? null : "Enter a valid email address";
    case "phone":
      return PHONE_RE.test(text) ? null : "Enter a valid phone number";
    case "url":
      try {
        const u = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
        return u.hostname.includes(".") ? null : "Enter a valid URL";
      } catch {
        return "Enter a valid URL";
      }
    case "number": {
      const n = Number(text);
      if (!Number.isFinite(n)) return "Enter a number";
      if (field.min !== undefined && n < field.min) return `Must be at least ${field.min}`;
      if (field.max !== undefined && n > field.max) return `Must be at most ${field.max}`;
      return null;
    }
    case "date":
      return Number.isNaN(Date.parse(text)) ? "Enter a valid date" : null;
    case "select":
    case "radio":
      return field.options?.some((o) => o.id === text) ? null : "Choose an option";
    case "checkbox": {
      const arr = Array.isArray(value) ? value : [];
      const ids = new Set(field.options?.map((o) => o.id));
      return arr.every((v) => ids.has(String(v))) ? null : "Choose valid options";
    }
    case "text":
      return text.length > 1000 ? "Keep it under 1,000 characters" : null;
    case "textarea":
      return text.length > 10000 ? "Keep it under 10,000 characters" : null;
  }
  return null;
}

/** Validate all visible fields. Returns a map of fieldId → error. */
export function validateAnswers(
  fields: Field[],
  answers: Record<string, AnswerValue>,
  uploadedFileFieldIds: Set<string> = new Set(),
) {
  const errors: Record<string, string> = {};
  for (const field of visibleFields(fields, answers)) {
    if (field.type === "file") {
      if (field.required && !uploadedFileFieldIds.has(field.id)) errors[field.id] = "Please upload a file";
      continue;
    }
    const err = validateField(field, answers[field.id]);
    if (err) errors[field.id] = err;
  }
  return errors;
}

/** Strip answers for unknown or hidden fields before saving. */
export function sanitizeAnswers(fields: Field[], answers: Record<string, AnswerValue>) {
  const out: Record<string, AnswerValue> = {};
  const byId = new Map(fields.map((f) => [f.id, f]));
  for (const [key, value] of Object.entries(answers)) {
    const field = byId.get(key);
    if (!field || field.type === "file") continue;
    if (field.type === "checkbox") out[key] = Array.isArray(value) ? value.map(String).slice(0, 50) : [];
    else if (value === null || value === undefined) out[key] = null;
    else out[key] = String(value).slice(0, 10000);
  }
  return out;
}

// -------------------------------------------------------------- files ----
const CATEGORY_MIME: Record<Exclude<FileCategory, "any">, { mimes: string[]; exts: string[] }> = {
  pdf: { mimes: ["application/pdf"], exts: ["pdf"] },
  images: { mimes: ["image/png", "image/jpeg", "image/gif", "image/webp", "image/heic", "image/heif", "image/svg+xml"], exts: ["png", "jpg", "jpeg", "gif", "webp", "heic", "heif", "svg"] },
  documents: {
    mimes: ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "application/rtf", "application/vnd.oasis.opendocument.text", "text/markdown"],
    exts: ["doc", "docx", "txt", "rtf", "odt", "md"],
  },
  spreadsheets: {
    mimes: ["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv", "application/vnd.oasis.opendocument.spreadsheet"],
    exts: ["xls", "xlsx", "csv", "ods"],
  },
  presentations: {
    mimes: ["application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.oasis.opendocument.presentation"],
    exts: ["ppt", "pptx", "odp", "key"],
  },
  video: { mimes: ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"], exts: ["mp4", "mov", "webm", "avi", "m4v"] },
  audio: { mimes: ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/aac", "audio/ogg"], exts: ["mp3", "wav", "m4a", "aac", "ogg"] },
  archives: { mimes: ["application/zip", "application/x-zip-compressed"], exts: ["zip"] },
  design: { mimes: ["application/postscript", "image/vnd.adobe.photoshop", "application/illustrator", "image/svg+xml", "application/octet-stream"], exts: ["ai", "psd", "eps", "svg", "fig", "sketch", "indd", "xd"] },
};

// Never accepted, whatever the category.
const BLOCKED_EXTS = new Set(["exe", "bat", "cmd", "com", "msi", "scr", "js", "vbs", "ps1", "sh", "jar", "app", "dll", "html", "htm", "php"]);

export function acceptAttribute(accept: FileCategory[] = ["any"]) {
  if (accept.includes("any")) return undefined;
  return accept.flatMap((c) => CATEGORY_MIME[c as Exclude<FileCategory, "any">].exts.map((e) => `.${e}`)).join(",");
}

export function isFileAllowed(fileName: string, mime: string, accept: FileCategory[] = ["any"]) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!ext || BLOCKED_EXTS.has(ext)) return false;
  if (accept.includes("any")) return true;
  return accept.some((c) => {
    const rule = CATEGORY_MIME[c as Exclude<FileCategory, "any">];
    // Extension must match; MIME must match too unless the browser gave a generic type.
    const extOk = rule.exts.includes(ext);
    const mimeOk = !mime || mime === "application/octet-stream" || rule.mimes.includes(mime);
    return extOk && mimeOk;
  });
}

// ------------------------------------------------------------ builders ----
export function newField(type: Field["type"] = "text"): Field {
  const base: Field = { id: uid("f_"), type, label: "", required: false };
  if (type === "select" || type === "radio" || type === "checkbox") {
    base.options = [
      { id: uid("o_"), label: "Option 1" },
      { id: uid("o_"), label: "Option 2" },
    ];
  }
  if (type === "file") {
    base.accept = ["any"];
    base.maxSizeMb = 25;
  }
  return base;
}

export function newStep(type: Step["type"]): Step {
  const id = uid("s_");
  switch (type) {
    case "form":
      return { id, type, title: "Tell us about your business", required: true, config: { fields: [{ ...newField("text"), label: "Business name", required: true }] } };
    case "files":
      return { id, type, title: "Upload your files", required: true, config: { items: [{ id: uid("d_"), label: "Logo files", required: true, accept: ["images", "design", "pdf"], maxSizeMb: 25, multiple: true }] } };
    case "access":
      return { id, type, title: "Grant account access", required: true, config: { items: [{ id: uid("a_"), platform: "google_analytics", required: true }] } };
    case "agreement":
      return {
        id,
        type,
        title: "Review & sign the agreement",
        required: true,
        config: {
          agreementTitle: "Services Agreement",
          body: "This Services Agreement is made between {{workspace.name}} (\"Provider\") and {{client.company}} (\"Client\"), represented by {{client.name}}, on {{date}}.\n\n1. Services. Provider will deliver the services described in the project proposal.\n\n2. Fees. Client agrees to pay the fees set out in the proposal.\n\n3. Term. This agreement starts on the date above and continues until the services are complete.",
        },
      };
    case "payment":
      return { id, type, title: "Pay your deposit", required: true, config: { amountCents: 50000, currency: "usd", kind: "deposit", description: "Project deposit" } };
  }
}

/** Give every step/field/item a fresh id (used when duplicating). */
export function cloneStep(step: Step): Step {
  const copy = structuredClone(step) as Step;
  copy.id = uid("s_");
  if (copy.type === "form") {
    const remap = new Map<string, string>();
    copy.config.fields.forEach((f) => {
      const next = uid("f_");
      remap.set(f.id, next);
      f.id = next;
    });
    copy.config.fields.forEach((f) => {
      if (f.condition) f.condition.fieldId = remap.get(f.condition.fieldId) ?? f.condition.fieldId;
    });
  }
  if (copy.type === "files") copy.config.items.forEach((i) => (i.id = uid("d_")));
  if (copy.type === "access") copy.config.items.forEach((i) => (i.id = uid("a_")));
  return copy;
}
