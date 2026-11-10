"use client";
import * as React from "react";
import { AlertDialog as A } from "radix-ui";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

const AlertDialog = A.Root;
const AlertDialogTrigger = A.Trigger;

function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof A.Content>) {
  return (
    <A.Portal>
      <A.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <A.Content
        className={cn("fixed top-[50%] left-[50%] z-50 grid w-[calc(100%-2rem)] max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl border bg-popover p-6 shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]", className)}
        {...props}
      />
    </A.Portal>
  );
}
const AlertDialogHeader = ({ className, ...p }: React.ComponentProps<"div">) => <div className={cn("flex flex-col gap-1.5", className)} {...p} />;
const AlertDialogFooter = ({ className, ...p }: React.ComponentProps<"div">) => <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...p} />;
const AlertDialogTitle = ({ className, ...p }: React.ComponentProps<typeof A.Title>) => <A.Title className={cn("text-base font-semibold", className)} {...p} />;
const AlertDialogDescription = ({ className, ...p }: React.ComponentProps<typeof A.Description>) => <A.Description className={cn("text-sm text-muted-foreground", className)} {...p} />;
const AlertDialogAction = ({ className, destructive, ...p }: React.ComponentProps<typeof A.Action> & { destructive?: boolean }) => (
  <A.Action className={cn(buttonVariants({ variant: destructive ? "destructive" : "default" }), className)} {...p} />
);
const AlertDialogCancel = ({ className, ...p }: React.ComponentProps<typeof A.Cancel>) => <A.Cancel className={cn(buttonVariants({ variant: "outline" }), className)} {...p} />;

export { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel };
