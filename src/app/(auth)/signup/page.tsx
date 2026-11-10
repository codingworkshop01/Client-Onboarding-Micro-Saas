import Link from "next/link";
import { signUp } from "../actions";
import { AuthForm, AuthHeading } from "../auth-form";

export const metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string; email?: string }> }) {
  const { next, email } = await searchParams;
  return (
    <>
      <AuthHeading title="Create your account" subtitle="Start onboarding clients in minutes. No credit card required." />
      <AuthForm
        action={signUp}
        next={next}
        submitLabel="Create account"
        fields={[
          { name: "fullName", label: "Full name", autoComplete: "name", placeholder: "Alex Morgan" },
          { name: "email", label: "Work email", type: "email", autoComplete: "email", placeholder: "you@agency.com", defaultValue: email },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password", placeholder: "At least 8 characters" },
        ]}
        footer={<>Already have an account? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-foreground hover:underline">Sign in</Link></>}
      />
    </>
  );
}
