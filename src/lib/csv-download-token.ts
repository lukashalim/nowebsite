import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 10 * 60 * 1000;

export interface CsvDownloadTokenPayload {
  email: string;
  type: "category" | "state" | "facebook";
  slug?: string;
  exp: number;
}

function getCsvDownloadSecret(): string {
  const secret =
    process.env.CSV_DOWNLOAD_SECRET ?? process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error("Missing CSV_DOWNLOAD_SECRET or ADMIN_PASSWORD");
  }
  return secret;
}

function encodePayload(payload: CsvDownloadTokenPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(encoded: string): CsvDownloadTokenPayload | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as CsvDownloadTokenPayload;
    if (
      typeof parsed.email !== "string" ||
      typeof parsed.type !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    if (
      parsed.type !== "category" &&
      parsed.type !== "state" &&
      parsed.type !== "facebook"
    ) {
      return null;
    }
    if (parsed.slug !== undefined && typeof parsed.slug !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", getCsvDownloadSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function createCsvDownloadToken(
  email: string,
  type: CsvDownloadTokenPayload["type"],
  slug?: string,
): string {
  const payload: CsvDownloadTokenPayload = {
    email,
    type,
    slug,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encoded = encodePayload(payload);
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifyCsvDownloadToken(
  token: string,
): CsvDownloadTokenPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = sign(encoded);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  const payload = decodePayload(encoded);
  if (!payload || payload.exp < Date.now()) {
    return null;
  }

  return payload;
}
