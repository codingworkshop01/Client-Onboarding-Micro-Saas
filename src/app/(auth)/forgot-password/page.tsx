import Link from "next/link";
import { requestPasswordReset } from "../actions";
import { AuthForm, AuthHeading } from "../auth-form";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading title="Reset your password" subtitle="We'll email you a secure link to choose a new one." />
      <AuthForm
        action={requestPasswordReset}
        submitLabel="Send reset link"
        fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]}
        footer={<Link href="/login" className="font-medium text-foreground hover:underline">Back to sign in</Link>}
      />
    </>
  );
}
