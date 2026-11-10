import Link from "next/link";
import { signIn } from "../actions";
import { AuthForm, AuthHeading } from "../auth-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <AuthHeading title="Welcome back" subtitle="Sign in to your workspace." />
      <AuthForm
        action={signIn}
        next={next}
        submitLabel="Sign in"
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "you@agency.com" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password", hint: <Link href="/forgot-password" className="text-[13px] font-normal text-muted-foreground hover:text-foreground">Forgot password?</Link> },
        ]}
        footer={<>New here? <Link href="/signup" className="font-medium text-foreground hover:underline">Create an account</Link></>}
      />
    </>
  );
}
