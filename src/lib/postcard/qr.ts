import "server-only";

import QRCode from "qrcode";
import { POSTCARD_STORAGE_BUCKET } from "@/lib/postcard/capture";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/** Kept for local/debug embeds; Lob does not reliably render QR data URIs. */
export async function demoUrlToQrDataUri(demoUrl: string): Promise<string> {
  const svg = await qrSvgMarkup(demoUrl);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export async function qrSvgMarkup(demoUrl: string): Promise<string> {
  return QRCode.toString(demoUrl, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 200,
    color: { dark: "#18181b", light: "#ffffff" },
  });
}

export async function qrPngBuffer(demoUrl: string): Promise<Buffer> {
  return QRCode.toBuffer(demoUrl, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 400,
    color: { dark: "#18181b", light: "#ffffff" },
  });
}

function sanitizePlaceId(placeId: string): string {
  return String(placeId).replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Upload a PNG QR to public Storage so Lob can fetch it over HTTPS.
 * Runtime evidence: SVG/PNG data-URI QRs are present in HTML but missing in Lob proofs.
 */
export async function uploadPostcardQrPublicUrl(input: {
  /** URL encoded in the QR (scan redirect or demo). */
  targetUrl: string;
  placeId: string;
}): Promise<string> {
  const png = await qrPngBuffer(input.targetUrl);
  const path = `qr/${sanitizePlaceId(input.placeId)}.png`;
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.storage
    .from(POSTCARD_STORAGE_BUCKET)
    .upload(path, png, {
      upsert: true,
      contentType: "image/png",
      cacheControl: "3600",
    });
  if (error) {
    throw new Error(`QR upload failed: ${error.message}`);
  }
  const { data } = supabase.storage
    .from(POSTCARD_STORAGE_BUCKET)
    .getPublicUrl(path);
  if (!data.publicUrl) {
    throw new Error("QR upload succeeded but public URL was empty");
  }
  return data.publicUrl;
}
