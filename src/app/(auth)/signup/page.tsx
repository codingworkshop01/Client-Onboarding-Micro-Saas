import Link from "next/link";
import { signUp } from "../actions";
import { AuthForm, AuthHeading } from "../auth-form";

export const metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <AuthHeading title="Create your account" subtitle="Start onboarding clients in minutes. No credit card required." />
      <AuthForm
        action={signUp}
        submitLabel="Create account"
        fields={[
          { name: "fullName", label: "Full name", autoComplete: "name", placeholder: "Alex Morgan" },
          { name: "email", label: "Work email", type: "email", autoComplete: "email", placeholder: "you@agency.com" },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password", placeholder: "At least 8 characters" },
        ]}
        footer={<>Already have an account? <Link href="/login" className="font-medium text-foreground hover:underline">Sign in</Link></>}
      />
    </>
  );
}
