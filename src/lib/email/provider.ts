import "server-only";
import { env, features } from "@/lib/env";

export type OutgoingEmail = { to: string; subject: string; html: string; text: string; replyTo?: string };
export type SendResult =
  | { status: "sent"; provider: string; messageId?: string }
  | { status: "failed"; provider: string; error: string }
  | { status: "skipped"; provider: null; error: string };

/**
 * Sends through Resend when RESEND_API_KEY is set, otherwise SMTP (Mailpit
 * locally). With neither configured the email is NOT sent and the result says
 * so — the caller logs it as "skipped".
 */
export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  const provider = features.email();
  if (!provider) return { status: "skipped", provider: null, error: "Email is not configured" };

  try {
    if (provider === "resend") {
      const { Resend } = await import("resend");
      const resend = new Resend(env.resendApiKey);
      const { data, error } = await resend.emails.send({
        from: env.emailFrom,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        replyTo: email.replyTo,
      });
      if (error) return { status: "failed", provider, error: error.message };
      return { status: "sent", provider, messageId: data?.id };
    }
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
    });
    const info = await transport.sendMail({
      from: env.emailFrom,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo: email.replyTo,
    });
    return { status: "sent", provider: "smtp", messageId: info.messageId };
  } catch (e) {
    return { status: "failed", provider, error: e instanceof Error ? e.message : "Unknown email error" };
  }
}
