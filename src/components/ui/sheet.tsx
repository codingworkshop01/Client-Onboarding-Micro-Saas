"use client";
import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = D.Root;
const SheetTrigger = D.Trigger;
const SheetClose = D.Close;

function SheetContent({ className, children, side = "right", title, ...props }: React.ComponentProps<typeof D.Content> & { side?: "left" | "right"; title: string }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <D.Content
        className={cn(
          "fixed inset-y-0 z-50 flex w-[88%] max-w-sm flex-col bg-background shadow-pop duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
          side === "left" ? "left-0 border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left" : "right-0 border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
          className,
        )}
        {...props}
      >
        <D.Title className="sr-only">{title}</D.Title>
        {children}
        <D.Close className="absolute top-3.5 right-3 rounded-md p-1 text-muted-foreground hover:bg-accent">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent };
