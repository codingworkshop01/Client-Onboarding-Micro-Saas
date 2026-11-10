import type { AnswerValue, Step } from "@/lib/flows/schema";

export type PortalStepStatus = "not_started" | "in_progress" | "completed";

export type PortalStep = Step & {
  status: PortalStepStatus;
  data: { answers?: Record<string, AnswerValue>; confirmations?: Record<string, { confirmed: boolean; at: string }>; submitted_at?: string; skipped?: boolean };
};

export type PortalDocument = {
  id: string;
  stepId: string;
  itemKey: string;
  fileName: string;
  size: number;
  mimeType: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  uploadedAt: string;
  replaced: boolean;
};

export type PortalSignature = { stepId: string; signerName: string; signedAt: string; hasPdf: boolean };
export type PortalPayment = { stepId: string; status: "unpaid" | "pending" | "paid" | "failed" | "refunded"; amountCents: number; currency: string; receiptUrl: string | null; paidAt: string | null };
export type PortalComment = { id: string; authorType: "client" | "member" | "system"; authorName: string; body: string; createdAt: string };

export type PortalData = {
  request: { id: string; title: string; message: string | null; status: string; dueDate: string | null };
  workspace: { name: string; color: string; logoUrl: string | null; supportEmail: string | null; website: string | null; welcomeMessage: string | null; showBranding: boolean };
  client: { name: string; email: string; company: string | null };
  steps: PortalStep[];
  documents: PortalDocument[];
  signatures: PortalSignature[];
  payments: PortalPayment[];
  comments: PortalComment[];
  /** Agreement text with merge fields already filled, keyed by step id. */
  agreements: Record<string, string>;
  paymentsEnabled: boolean;
};

export type ActionRes<T = object> = ({ ok: true } & T) | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Everything the portal UI can do. Live mode calls the server; preview mode only touches local state. */
export type PortalAdapter = {
  mode: "live" | "preview";
  saveAnswers: (stepId: string, answers: Record<string, AnswerValue>) => Promise<ActionRes>;
  submitStep: (stepId: string) => Promise<ActionRes>;
  skipStep: (stepId: string) => Promise<ActionRes>;
  uploadFile: (stepId: string, itemKey: string, file: File, onProgress: (pct: number) => void) => Promise<ActionRes<{ document: PortalDocument }>>;
  removeFile: (documentId: string) => Promise<ActionRes>;
  confirmAccess: (stepId: string, itemId: string, confirmed: boolean) => Promise<ActionRes>;
  sign: (stepId: string, input: { signerName: string; signerEmail: string; type: "typed" | "drawn"; data: string; consent: boolean }) => Promise<ActionRes<{ signature: PortalSignature }>>;
  startPayment: (stepId: string) => Promise<ActionRes<{ url: string }>>;
  postComment: (body: string) => Promise<ActionRes<{ comment: PortalComment }>>;
  signedPdfUrl?: (stepId: string) => string;
  refresh: () => void;
};
