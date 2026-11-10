import { CreditCard, FileSignature, FolderUp, KeyRound, ListChecks } from "lucide-react";
import type { StepType } from "@/lib/flows/schema";
import { cn } from "@/lib/utils";

export const STEP_ICON: Record<StepType, React.ComponentType<{ className?: string }>> = {
  form: ListChecks,
  files: FolderUp,
  access: KeyRound,
  agreement: FileSignature,
  payment: CreditCard,
};

const TONE: Record<StepType, string> = {
  form: "bg-[#eef2ff] text-[#4338ca] dark:bg-[#1e1b4b] dark:text-[#a5b4fc]",
  files: "bg-[#ecfeff] text-[#0e7490] dark:bg-[#083344] dark:text-[#67e8f9]",
  access: "bg-[#fff7ed] text-[#c2410c] dark:bg-[#2a1608] dark:text-[#fdba74]",
  agreement: "bg-[#f5f3ff] text-[#6d28d9] dark:bg-[#2e1065] dark:text-[#c4b5fd]",
  payment: "bg-[#f0fdf4] text-[#15803d] dark:bg-[#052e16] dark:text-[#86efac]",
};

export function StepTypeIcon({ type, className }: { type: StepType; className?: string }) {
  const Icon = STEP_ICON[type];
  return (
    <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-md", TONE[type], className)}>
      <Icon className="size-[55%]" />
    </span>
  );
}
