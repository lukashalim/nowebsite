import "server-only";

import { Resend } from "resend";
import { loadSharedEnvLocal } from "@/lib/load-shared-env";

const FROM =
  "No-Website Business Leads <leads@mail.botsbridge.com>";

/** Resend attachment soft limit we use (~5MB). */
export const LIST_PURCHASE_EMAIL_ATTACH_MAX_BYTES = 5 * 1024 * 1024;

export const LIST_PURCHASE_EMAIL_LINK_TTL_SECONDS = 48 * 60 * 60;

function getResend(): Resend | null {
  loadSharedEnvLocal();
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

export async function sendListPurchaseCsvEmail(input: {
  to: string;
  scopeLabel: string;
  recordCount: number;
  filename: string;
  csvUtf8: string;
  /** Used when CSV is too large to attach. */
  downloadUrl?: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const scope = input.scopeLabel.trim() || "list";
  const n = input.recordCount.toLocaleString();
  const subject = `Your ${scope} list is ready — ${n} records`;
  const csvBytes = Buffer.byteLength(input.csvUtf8, "utf8");
  const attach = csvBytes <= LIST_PURCHASE_EMAIL_ATTACH_MAX_BYTES;

  let text =
    `Here's the CSV you just purchased on nowebsitebusinessleads.com for ${scope} — ${n} records.\n\n`;

  if (attach) {
    text += "Your file is attached to this email.\n";
  } else if (input.downloadUrl) {
    text +=
      `The file was too large to attach. Download it here (link expires in about 48 hours):\n\n${input.downloadUrl}\n`;
  } else {
    throw new Error("CSV too large to attach and no downloadUrl provided");
  }

  text +=
    "\nIf you already downloaded the file in your browser, you can ignore this email.\n";

  const { error } = await resend.emails.send({
    from: FROM,
    to: input.to,
    subject,
    text,
    attachments: attach
      ? [
          {
            filename: input.filename,
            content: Buffer.from(input.csvUtf8, "utf8"),
            contentType: "text/csv",
          },
        ]
      : undefined,
  });

  if (error) {
    throw new Error(error.message);
  }
}
