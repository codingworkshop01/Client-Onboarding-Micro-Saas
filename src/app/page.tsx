import Link from "next/link";
import { ArrowRight, Check, CreditCard, FileSignature, FolderUp, KeyRound, ListChecks, Lock, Sparkles, BellRing } from "lucide-react";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/app/logo";
import { PLANS, type PlanTier } from "@/lib/plans";

const FLOW = [
  { icon: ListChecks, title: "Information", body: "Smart forms with conditional questions and autosave." },
  { icon: FolderUp, title: "Files", body: "Request exact documents, then approve or ask for a re-upload." },
  { icon: KeyRound, title: "Account access", body: "Step-by-step guides for Meta, Google, WordPress, Shopify. No passwords." },
  { icon: FileSignature, title: "Agreement", body: "Typed or drawn e-signature with an audit trail and signed PDF." },
  { icon: CreditCard, title: "Payment", body: "Deposits through Stripe, straight to your account." },
];

export default async function Home() {
  const user = await getUser();
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-2">
          <a href="#pricing" className="hidden px-3 text-sm text-muted-foreground hover:text-foreground sm:block">Pricing</a>
          {user ? (
            <Button asChild size="sm"><Link href="/dashboard">Dashboard<ArrowRight /></Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link href="/login">Sign in</Link></Button>
              <Button asChild size="sm"><Link href="/signup">Start free</Link></Button>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pt-16 pb-20 text-center sm:px-8 sm:pt-24">
          <div className="mx-auto mb-5 inline-flex items-center gap-1.5 rounded-full border bg-surface px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-[#7c3aed]" />New: build an onboarding from any proposal with AI
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">One link. Complete client onboarding.</h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-balance text-muted-foreground sm:text-lg">
            Collect information, files, account access, a signed agreement and the deposit in one branded checklist your clients actually finish.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="xl"><Link href={user ? "/dashboard" : "/signup"}>Start onboarding clients<ArrowRight /></Link></Button>
            <Button asChild size="xl" variant="outline"><a href="#how">See how it works</a></Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Free plan · no credit card · set up in five minutes</p>

          <div id="how" className="relative mx-auto mt-16 max-w-4xl scroll-mt-10">
            <div className="grid gap-3 text-left sm:grid-cols-5">
              {FLOW.map((s, i) => (
                <div key={s.title} className="relative rounded-xl border bg-card p-4 shadow-card">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-surface"><s.icon className="size-4" /></span>
                    <span className="text-xs text-muted-foreground tabular">0{i + 1}</span>
                  </div>
                  <div className="text-sm font-semibold">{s.title}</div>
                  <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
            <div className="mx-auto mt-3 flex max-w-max items-center gap-2 rounded-full border bg-success-soft px-3 py-1 text-xs font-medium text-success"><Check className="size-3.5" />Ready to start</div>
          </div>
        </section>

        <section className="border-y bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 md:grid-cols-3">
            {[
              { icon: Sparkles, title: "AI Request Builder", body: "Paste a proposal or email. Get tailored questions, a document checklist, access steps, an agreement draft and a payment step. You review everything before it's sent." },
              { icon: BellRing, title: "Reminders that stop themselves", body: "Gentle automatic nudges until your client finishes, then they stop. Send a manual reminder or an AI-drafted one in a click." },
              { icon: Lock, title: "Secure by default", body: "Expiring magic links, private file storage with signed URLs, workspace isolation, audit logs, and no passwords ever collected." },
            ].map((f) => (
              <div key={f.title}>
                <f.icon className="mb-3 size-5" />
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-10 px-5 py-20 sm:px-8">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Simple pricing</h2>
          <p className="mt-2 text-center text-muted-foreground">Start free. Upgrade when onboarding pays for itself.</p>
          <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(PLANS) as PlanTier[]).map((k) => {
              const p = PLANS[k];
              return (
                <div key={k} className={`flex flex-col rounded-xl border bg-card p-5 shadow-card ${k === "agency" ? "ring-2 ring-foreground" : ""}`}>
                  <div className="flex items-center justify-between"><h3 className="font-semibold">{p.name}</h3>{k === "agency" && <span className="rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground">Popular</span>}</div>
                  <p className="text-[13px] text-muted-foreground">{p.tagline}</p>
                  <div className="mt-4 text-3xl font-semibold tabular">${p.priceMonthly}<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                  <ul className="mt-5 grid flex-1 gap-2 text-sm">{p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" />{f}</li>)}</ul>
                  <Button asChild className="mt-6" variant={k === "agency" ? "default" : "outline"}><Link href="/signup">{k === "free" ? "Start free" : `Choose ${p.name}`}</Link></Button>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:px-8">
          <Logo className="text-foreground" />
          <span>© {new Date().getFullYear()} · Built for agencies and freelancers</span>
        </div>
      </footer>
    </div>
  );
}
