import * as React from "react";
import { cn } from "@/lib/utils";

export const inputBase =
  "w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-destructive/15";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(inputBase, "h-9 py-1 file:border-0 file:bg-transparent file:text-sm file:font-medium", className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(inputBase, "min-h-20 py-2 leading-relaxed field-sizing-content", className)} {...props} />;
}

export { Input, Textarea };
