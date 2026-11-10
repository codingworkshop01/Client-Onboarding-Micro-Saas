"use client";
import * as React from "react";
import { Checkbox as C, RadioGroup as R, Switch as Sw } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

function Checkbox({ className, ...props }: React.ComponentProps<typeof C.Root>) {
  return (
    <C.Root
      className={cn("peer size-4 shrink-0 rounded-[4px] border border-input bg-background shadow-xs outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground aria-invalid:border-destructive", className)}
      {...props}
    >
      <C.Indicator className="flex items-center justify-center"><Check className="size-3" strokeWidth={3} /></C.Indicator>
    </C.Root>
  );
}

function RadioGroup({ className, ...props }: React.ComponentProps<typeof R.Root>) {
  return <R.Root className={cn("grid gap-2", className)} {...props} />;
}
function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof R.Item>) {
  return (
    <R.Item
      className={cn("aspect-square size-4 shrink-0 rounded-full border border-input bg-background shadow-xs outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-50 data-[state=checked]:border-primary", className)}
      {...props}
    >
      <R.Indicator className="flex items-center justify-center"><span className="size-2 rounded-full bg-primary" /></R.Indicator>
    </R.Item>
  );
}

function Switch({ className, ...props }: React.ComponentProps<typeof Sw.Root>) {
  return (
    <Sw.Root
      className={cn("peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent shadow-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input", className)}
      {...props}
    >
      <Sw.Thumb className="pointer-events-none block size-4 rounded-full bg-background shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5" />
    </Sw.Root>
  );
}

export { Checkbox, RadioGroup, RadioGroupItem, Switch };
