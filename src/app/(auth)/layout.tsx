import Link from "next/link";
import { Check } from "lucide-react";
import { Logo } from "@/components/app/logo";

const steps = ["Business details", "Brand assets", "Google Analytics access", "Sign agreement", "Pay deposit"];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Link href="/" className="w-fit"><Logo /></Link>
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px]">{children}</div>
        </main>
      </div>
      <aside className="relative hidden overflow-hidden border-l bg-surface lg:flex lg:items-center lg:justify-center">
        <div className="absolute inset-0 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:20px_20px] opacity-60" />
        <div className="relative w-[340px]">
          <p className="mb-4 text-sm font-medium text-muted-foreground">What your clients see</p>
          <div className="rounded-xl border bg-card p-5 shadow-pop">
            <div className="mb-1 text-sm font-semibold">Welcome, Acme Co.</div>
            <div className="mb-4 text-xs text-muted-foreground">3 of 5 steps complete</div>
            <div className="mb-5 h-1.5 rounded-full bg-muted"><div className="h-full w-3/5 rounded-full bg-[#4f46e5]" /></div>
            <ul className="space-y-2.5">
              {steps.map((s, i) => (
                <li key={s} className="flex items-center gap-3 text-sm">
                  {i < 3 ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-[#4f46e5] text-white"><Check className="size-3" strokeWidth={3} /></span>
                  ) : (
                    <span className="size-5 rounded-full border-2 border-dashed border-border" />
                  )}
                  <span className={i < 3 ? "text-muted-foreground line-through decoration-muted-foreground/40" : ""}>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-6 text-balance text-[15px] leading-relaxed text-muted-foreground">
            One link replaces the email back-and-forth: forms, files, access, signature and payment, done.
          </p>
        </div>
      </aside>
    </div>
  );
}
