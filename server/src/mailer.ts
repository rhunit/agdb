// Sending e-mail through Resend (RESEND_API_KEY), from
// rapport@amsterdamgenetics.com — shared by the weekly report and
// "Reviews mailen".

export const MAIL_FROM =
  process.env.REPORT_MAIL_FROM ?? "Amsterdam Genetics dashboard <rapport@amsterdamgenetics.com>";

export class MailError extends Error {}

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export interface OutgoingMail {
  to: string;
  subject: string;
  /** Plain-text body. */
  text?: string;
  html?: string;
  attachments?: { filename: string; content: Buffer }[];
}

export async function sendEmail(mail: OutgoingMail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new MailError("RESEND_API_KEY ontbreekt in de omgeving van de server.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [mail.to],
      subject: mail.subject,
      ...(mail.text !== undefined ? { text: mail.text } : {}),
      ...(mail.html !== undefined ? { html: mail.html } : {}),
      ...(mail.attachments
        ? { attachments: mail.attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })) }
        : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text();
    let message = body;
    try {
      message = (JSON.parse(body) as { message?: string }).message ?? body;
    } catch {
      // Not JSON: keep the text.
    }
    throw new MailError(`Resend weigerde de mail (${res.status}): ${message.slice(0, 300)}`);
  }
}

const EMAIL = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/i;

/** E-mail addresses from a list or a "a@b.nl, c@d.nl" string; throws on an invalid one. */
export function parseRecipients(input: unknown, max = 20): string[] {
  const list = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[\s,;]+/) : [];
  const out = [...new Set(list.map((x) => String(x).trim().toLowerCase()).filter(Boolean))];
  const bad = out.filter((e) => !EMAIL.test(e));
  if (bad.length > 0) throw new MailError(`Geen geldig e-mailadres: ${bad.join(", ")}`);
  if (out.length > max) throw new MailError(`Maximaal ${max} ontvangers.`);
  return out;
}
