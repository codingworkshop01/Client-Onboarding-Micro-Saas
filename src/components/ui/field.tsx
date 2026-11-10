import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

/** Label + control + description + error, with ids wired for accessibility. */
function Field({
  label, htmlFor, description, error, required, children, className, optionalHint,
}: {
  label?: React.ReactNode; htmlFor?: string; description?: React.ReactNode; error?: string | null; required?: boolean;
  children: React.ReactNode; className?: string; optionalHint?: boolean;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="text-destructive" aria-hidden>*</span>}
          {optionalHint && !required && <span className="font-normal text-muted-foreground">(optional)</span>}
        </Label>
      )}
      {description && <p id={htmlFor ? `${htmlFor}-desc` : undefined} className="-mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      {children}
      {error && <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="text-[13px] text-destructive">{error}</p>}
    </div>
  );
}

export { Field };
