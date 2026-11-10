import { readableOn } from "@/lib/utils";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Brand = { name: string; color: string; logoUrl?: string | null };

/** Minimal, client-safe transactional layout (tables for email clients). */
function layout(brand: Brand, body: string, cta?: { label: string; url: string }, footer?: string) {
  const btnText = readableOn(brand.color);
  const header = brand.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="${esc(brand.name)}" height="32" style="height:32px;max-width:180px;display:block">`
    : `<div style="font-size:16px;font-weight:600;color:#111">${esc(brand.name)}</div>`;
  return `<!doctype html><html><body style="margin:0;background:#f6f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1f1f1f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #e7e5e4;border-radius:12px">
<tr><td style="padding:28px 32px 0">${header}</td></tr>
<tr><td style="padding:20px 32px 8px;font-size:15px;line-height:1.6">${body}</td></tr>
${cta ? `<tr><td style="padding:12px 32px 28px"><a href="${esc(cta.url)}" style="display:inline-block;background:${brand.color};color:${btnText};text-decoration:none;font-weight:600;font-size:14px;padding:11px 18px;border-radius:8px">${esc(cta.label)}</a>
<p style="font-size:12px;color:#78716c;margin:16px 0 0">Or paste this link into your browser:<br><span style="word-break:break-all">${esc(cta.url)}</span></p></td></tr>` : ""}
</table>
<p style="font-size:12px;color:#a8a29e;margin:16px 0 0">${footer ? esc(footer) : `Sent by ${esc(brand.name)}`}</p>
</td></tr></table></body></html>`;
}

const paragraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

export function invitationEmail(input: { brand: Brand; clientName: string; title: string; message?: string | null; url: string; dueDate?: string | null; senderName: string }) {
  const due = input.dueDate ? `\n\nPlease complete it by ${new Date(`${input.dueDate}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.` : "";
  const intro = input.message?.trim() || `We're excited to get started. To kick things off, we've put everything we need from you into one simple checklist. It only takes a few minutes, and you can save and come back any time.`;
  const text = `Hi ${input.clientName},\n\n${intro}${due}\n\nStart here: ${input.url}\n\n${input.senderName}, ${input.brand.name}`;
  return {
    subject: `${input.brand.name}: ${input.title}`,
    text,
    html: layout(input.brand, paragraphs(`Hi ${input.clientName},\n\n${intro}${due}`), { label: "Start onboarding", url: input.url }, `${input.senderName} · ${input.brand.name}`),
  };
}

export function reminderEmail(input: { brand: Brand; clientName: string; title: string; url: string; remaining: number; body?: string | null }) {
  const body = input.body?.trim() || `Just a friendly nudge: you have ${input.remaining} ${input.remaining === 1 ? "item" : "items"} left in "${input.title}". Your progress is saved, so you can pick up right where you left off.`;
  return {
    subject: `Reminder: ${input.title}`,
    text: `Hi ${input.clientName},\n\n${body}\n\nContinue: ${input.url}\n\n${input.brand.name}`,
    html: layout(input.brand, paragraphs(`Hi ${input.clientName},\n\n${body}`), { label: "Continue onboarding", url: input.url }),
  };
}

export function completedEmail(input: { brand: Brand; clientName: string; title: string; url: string }) {
  return {
    subject: `${input.clientName} completed onboarding: ${input.title}`,
    text: `${input.clientName} has completed every required step of "${input.title}".\n\nReview: ${input.url}`,
    html: layout(input.brand, paragraphs(`Good news: ${input.clientName} has completed every required step of "${input.title}".`), { label: "Review submission", url: input.url }),
  };
}

export function replyEmail(input: { brand: Brand; clientName: string; authorName: string; body: string; url: string; title: string }) {
  return {
    subject: `${input.authorName} replied: ${input.title}`,
    text: `Hi ${input.clientName},\n\n${input.authorName} replied to your question:\n\n${input.body}\n\nView: ${input.url}`,
    html: layout(input.brand, paragraphs(`Hi ${input.clientName},\n\n${input.authorName} replied to your question:\n\n${input.body}`), { label: "View conversation", url: input.url }),
  };
}

export function teamInviteEmail(input: { brand: Brand; inviterName: string; role: string; url: string; appName: string }) {
  const body = `${input.inviterName} invited you to join ${input.brand.name} on ${input.appName} as ${input.role === "admin" ? "an admin" : "a team member"}.\n\nYou'll be able to create and manage client onboardings together. This invitation expires in 7 days.`;
  return {
    subject: `Join ${input.brand.name} on ${input.appName}`,
    text: `${body}\n\nAccept: ${input.url}`,
    html: layout(input.brand, paragraphs(body), { label: "Accept invitation", url: input.url }),
  };
}
