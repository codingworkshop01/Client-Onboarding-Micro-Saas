"use client";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tabs";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        {children}
        <Toaster position="bottom-right" toastOptions={{ classNames: { toast: "!rounded-lg !border !border-border !bg-popover !text-popover-foreground !shadow-pop !text-sm" } }} />
      </TooltipProvider>
    </ThemeProvider>
  );
}
