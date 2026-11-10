import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * Signed agreement PDF: the agreement text, the signature block, and an audit
 * certificate page (signer, timestamp, IP, user agent, SHA-256 of the text).
 */
export async function buildSignedAgreementPdf(input: {
  agencyName: string;
  title: string;
  body: string;
  signerName: string;
  signerEmail: string;
  signatureType: "typed" | "drawn";
  signatureData: string;
  signedAt: Date;
  ip: string | null;
  userAgent: string | null;
  documentHash: string;
  consentText: string;
  requestId: string;
}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${input.title}, signed`);
  pdf.setAuthor(input.agencyName);
  pdf.setCreationDate(input.signedAt);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const W = 595.28, H = 841.89, M = 56, LH = 15;
  let page = pdf.addPage([W, H]);
  let y = H - M;

  const ensure = (needed: number) => {
    if (y - needed < M) { page = pdf.addPage([W, H]); y = H - M; }
  };
  const write = (text: string, f: PDFFont, size: number, color = rgb(0.1, 0.1, 0.12), lineHeight = LH) => {
    for (const line of wrap(sanitize(text), f, size, W - M * 2)) {
      ensure(lineHeight);
      page.drawText(line, { x: M, y, size, font: f, color });
      y -= lineHeight;
    }
  };

  page.drawText(sanitize(input.agencyName), { x: M, y, size: 10, font: bold, color: rgb(0.4, 0.4, 0.45) });
  y -= 30;
  write(input.title, bold, 18, rgb(0.05, 0.05, 0.07), 24);
  y -= 8;
  for (const para of input.body.split(/\n/)) {
    if (!para.trim()) { y -= LH * 0.6; continue; }
    write(para, font, 10.5);
  }

  // Signature block
  y -= 20;
  ensure(140);
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
  y -= 22;
  page.drawText("Signed electronically by", { x: M, y, size: 9, font, color: rgb(0.45, 0.45, 0.5) });
  y -= 10;
  if (input.signatureType === "drawn" && input.signatureData.startsWith("data:image/png;base64,")) {
    const png = await pdf.embedPng(Buffer.from(input.signatureData.split(",")[1]!, "base64"));
    const scale = Math.min(200 / png.width, 70 / png.height);
    y -= png.height * scale;
    page.drawImage(png, { x: M, y, width: png.width * scale, height: png.height * scale });
  } else {
    y -= 30;
    page.drawText(sanitize(input.signatureData), { x: M, y, size: 24, font: italic, color: rgb(0.08, 0.1, 0.3) });
  }
  y -= 16;
  page.drawText(`${sanitize(input.signerName)} <${sanitize(input.signerEmail)}>`, { x: M, y, size: 10, font: bold });
  y -= 14;
  page.drawText(`${input.signedAt.toUTCString()}`, { x: M, y, size: 9, font, color: rgb(0.4, 0.4, 0.45) });

  // Audit certificate
  page = pdf.addPage([W, H]);
  y = H - M;
  write("Signature certificate", bold, 16, rgb(0.05, 0.05, 0.07), 22);
  y -= 6;
  const rows: [string, string][] = [
    ["Document", input.title],
    ["Reference", input.requestId],
    ["Signer", `${input.signerName} (${input.signerEmail})`],
    ["Method", input.signatureType === "drawn" ? "Hand-drawn signature" : "Typed signature"],
    ["Signed at (UTC)", input.signedAt.toISOString()],
    ["IP address", input.ip ?? "Not available"],
    ["User agent", input.userAgent ?? "Not available"],
    ["Document SHA-256", input.documentHash],
  ];
  for (const [k, v] of rows) {
    ensure(LH * 2);
    page.drawText(k, { x: M, y, size: 9, font: bold, color: rgb(0.35, 0.35, 0.4) });
    const lines = wrap(sanitize(v), font, 9.5, W - M * 2 - 120);
    lines.forEach((l, i) => page.drawText(l, { x: M + 120, y: y - i * 13, size: 9.5, font }));
    y -= Math.max(LH + 4, lines.length * 13 + 6);
  }
  y -= 10;
  write("Consent given by signer", bold, 10);
  write(input.consentText, font, 9.5, rgb(0.25, 0.25, 0.3), 13);
  y -= 8;
  write("The SHA-256 hash above is computed over the exact agreement text shown to the signer. Any change to the text produces a different hash.", italic, 8.5, rgb(0.45, 0.45, 0.5), 12);
  drawFooter(pdf.getPages(), font, input.agencyName);
  return pdf.save();
}

function drawFooter(pages: PDFPage[], font: PDFFont, agency: string) {
  pages.forEach((p, i) => p.drawText(`${sanitize(agency)} · Page ${i + 1} of ${pages.length}`, { x: 56, y: 28, size: 8, font, color: rgb(0.6, 0.6, 0.65) }));
}

/** Standard PDF fonts only support WinAnsi; replace anything else. */
function sanitize(s: string) {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\t/g, "    ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) { line = next; continue; }
    if (line) lines.push(line);
    // Hard-break very long words (URLs, hashes)
    let w = word;
    while (font.widthOfTextAtSize(w, size) > maxWidth) {
      let cut = w.length;
      while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxWidth) cut--;
      lines.push(w.slice(0, cut));
      w = w.slice(cut);
    }
    line = w;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}
