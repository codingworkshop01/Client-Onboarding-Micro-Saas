"use client";
import { FlowBuilder, type Brand } from "@/components/builder/flow-builder";
import type { AgreementOption } from "@/components/builder/step-editors";
import type { TemplateInput } from "@/lib/flows/schema";
import { saveTemplate } from "../actions";

export function TemplateEditor({ id, initial, agreements, paymentsEnabled, brand }: {
  id: string; initial: TemplateInput; agreements: AgreementOption[]; paymentsEnabled: boolean; brand: Brand;
}) {
  return (
    <FlowBuilder
      initial={initial}
      onSave={(draft) => saveTemplate(id, draft)}
      agreements={agreements}
      paymentsEnabled={paymentsEnabled}
      brand={brand}
    />
  );
}
