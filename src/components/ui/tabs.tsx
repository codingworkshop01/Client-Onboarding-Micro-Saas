"use client";
import * as React from "react";
import { Tabs as T, Tooltip as Tip, Popover as P } from "radix-ui";
import { cn } from "@/lib/utils";

const Tabs = T.Root;
function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn("scrollbar-none flex items-center gap-1 overflow-x-auto border-b", className)} {...props} />;
}
function TabsTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "relative -mb-px inline-flex h-9 items-center gap-1.5 border-b-2 border-transparent px-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}
function TabsContent({ className, ...props }: React.ComponentProps<typeof T.Content>) {
  return <T.Content className={cn("outline-none data-[state=active]:animate-in data-[state=active]:fade-in-0", className)} {...props} />;
}

const TooltipProvider = Tip.Provider;
function Tooltip({ children, content, side = "top" }: { children: React.ReactNode; content: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <Tip.Root delayDuration={250}>
      <Tip.Trigger asChild>{children}</Tip.Trigger>
      <Tip.Portal>
        <Tip.Content side={side} sideOffset={6} className="z-50 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground shadow-pop data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0">
          {content}
        </Tip.Content>
      </Tip.Portal>
    </Tip.Root>
  );
}

const Popover = P.Root;
const PopoverTrigger = P.Trigger;
function PopoverContent({ className, align = "start", sideOffset = 6, ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content align={align} sideOffset={sideOffset} className={cn("z-50 w-72 rounded-lg border bg-popover p-4 text-popover-foreground shadow-pop outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0", className)} {...props} />
    </P.Portal>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, TooltipProvider, Tooltip, Popover, PopoverTrigger, PopoverContent };
