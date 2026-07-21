import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  USAGE_EVENT_COLUMNS,
  USAGE_EVENTS_TABLE,
  type UsageEventType,
} from "@/lib/usage-storage";

export type PostcardTrackingMode = "live" | "test";
export type PostcardTrackingPeriod = "month" | "all";
export type PostcardTrackingStatus = "all" | "scanned" | "unscanned";

export interface AdminPostcardRow {
  sendId: number;
  userId: string;
  placeId: string;
  sentAt: string;
  scannedAt: string | null;
  businessName: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  senderEmail: string | null;
}

const ROW_CAP = 200;

export function eventTypesForMode(mode: PostcardTrackingMode): {
  sent: UsageEventType;
  scanned: UsageEventType;
} {
  if (mode === "test") {
    return {
      sent: "postcard_sent_test",
      scanned: "postcard_scanned_test",
    };
  }
  return {
    sent: "postcard_sent",
    scanned: "postcard_scanned",
  };
}

/** CRM Mail filter: map UI production/test onto tracking live/test event types. */
export function postcardTrackingModeFromCrm(
  mode: "test" | "production",
): PostcardTrackingMode {
  return mode === "test" ? "test" : "live";
}

/**
 * Distinct place_ids the user has mailed (and which of those were scanned)
 * for a Lob test or live stream. Used by CRM Mail status filters.
 */
export async function fetchUserPostcardPlaceIdSets(input: {
  userId: string;
  mode: PostcardTrackingMode;
}): Promise<{
  sentPlaceIds: string[];
  scannedPlaceIds: string[];
  notScannedPlaceIds: string[];
  error: string | null;
}> {
  const { sent: sentType, scanned: scannedType } = eventTypesForMode(
    input.mode,
  );
  const admin = createSupabaseAdmin();

  // Higher cap than the tracker table UI — list filters need complete membership.
  const PLACE_SET_CAP = 10_000;

  const { data: sentRows, error: sentError } = await admin
    .from(USAGE_EVENTS_TABLE)
    .select("lead_id, created_at")
    .eq(USAGE_EVENT_COLUMNS.eventType, sentType)
    .eq(USAGE_EVENT_COLUMNS.userId, input.userId)
    .not(USAGE_EVENT_COLUMNS.leadId, "is", null)
    .order(USAGE_EVENT_COLUMNS.createdAt, { ascending: false })
    .limit(PLACE_SET_CAP);

  if (sentError) {
    return {
      sentPlaceIds: [],
      scannedPlaceIds: [],
      notScannedPlaceIds: [],
      error: sentError.message,
    };
  }

  /** Latest send time per place (scan must be on/after that send). */
  const latestSendByPlace = new Map<string, string>();
  for (const row of sentRows ?? []) {
    const placeId =
      typeof row.lead_id === "string" ? row.lead_id.trim() : "";
    const sentAt =
      typeof row.created_at === "string" ? row.created_at : "";
    if (!placeId || !sentAt) continue;
    // Rows are newest-first; first write wins as latest.
    if (!latestSendByPlace.has(placeId)) {
      latestSendByPlace.set(placeId, sentAt);
    }
  }

  const sentPlaceIds = [...latestSendByPlace.keys()];
  if (sentPlaceIds.length === 0) {
    return {
      sentPlaceIds: [],
      scannedPlaceIds: [],
      notScannedPlaceIds: [],
      error: null,
    };
  }

  const scannedPlaceIds = new Set<string>();
  for (const placeChunk of chunk(sentPlaceIds, 80)) {
    const { data: scanRows, error: scanError } = await admin
      .from(USAGE_EVENTS_TABLE)
      .select("lead_id, created_at")
      .eq(USAGE_EVENT_COLUMNS.eventType, scannedType)
      .eq(USAGE_EVENT_COLUMNS.userId, input.userId)
      .in(USAGE_EVENT_COLUMNS.leadId, placeChunk)
      .order(USAGE_EVENT_COLUMNS.createdAt, { ascending: true });

    if (scanError) {
      return {
        sentPlaceIds: [],
        scannedPlaceIds: [],
        notScannedPlaceIds: [],
        error: scanError.message,
      };
    }

    for (const row of scanRows ?? []) {
      const placeId =
        typeof row.lead_id === "string" ? row.lead_id.trim() : "";
      const createdAt =
        typeof row.created_at === "string" ? row.created_at : "";
      if (!placeId || !createdAt) continue;
      const latestSend = latestSendByPlace.get(placeId);
      if (latestSend && createdAt >= latestSend) {
        scannedPlaceIds.add(placeId);
      }
    }
  }

  const scannedList = [...scannedPlaceIds];
  const notScannedPlaceIds = sentPlaceIds.filter(
    (id) => !scannedPlaceIds.has(id),
  );

  return {
    sentPlaceIds,
    scannedPlaceIds: scannedList,
    notScannedPlaceIds,
    error: null,
  };
}

function monthStartUtcIso(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export async function fetchAdminPostcardTracking(input: {
  mode: PostcardTrackingMode;
  period: PostcardTrackingPeriod;
  status: PostcardTrackingStatus;
  /** When set, only that user's sends (CRM view). */
  userId?: string;
}): Promise<{ rows: AdminPostcardRow[]; error: string | null }> {
  const { sent: sentType, scanned: scannedType } = eventTypesForMode(
    input.mode,
  );
  const admin = createSupabaseAdmin();

  let sentQuery = admin
    .from(USAGE_EVENTS_TABLE)
    .select("id, user_id, lead_id, created_at")
    .eq(USAGE_EVENT_COLUMNS.eventType, sentType)
    .not(USAGE_EVENT_COLUMNS.leadId, "is", null)
    .order(USAGE_EVENT_COLUMNS.createdAt, { ascending: false })
    .limit(ROW_CAP);

  if (input.userId) {
    sentQuery = sentQuery.eq(USAGE_EVENT_COLUMNS.userId, input.userId);
  }

  if (input.period === "month") {
    sentQuery = sentQuery.gte(USAGE_EVENT_COLUMNS.createdAt, monthStartUtcIso());
  }

  const { data: sentRows, error: sentError } = await sentQuery;
  if (sentError) {
    return { rows: [], error: sentError.message };
  }

  const sends = (sentRows ?? [])
    .map((row) => {
      const placeId =
        typeof row.lead_id === "string" ? row.lead_id.trim() : "";
      const userId = typeof row.user_id === "string" ? row.user_id : "";
      const sentAt =
        typeof row.created_at === "string" ? row.created_at : "";
      const id = typeof row.id === "number" ? row.id : Number(row.id);
      if (!placeId || !userId || !sentAt || !Number.isFinite(id)) return null;
      return { id, userId, placeId, sentAt };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  if (sends.length === 0) {
    return { rows: [], error: null };
  }

  const userIds = [...new Set(sends.map((s) => s.userId))];
  const placeIds = [...new Set(sends.map((s) => s.placeId))];

  const scanByKey = new Map<string, string[]>();
  for (const userChunk of chunk(userIds, 50)) {
    const { data: scanRows, error: scanError } = await admin
      .from(USAGE_EVENTS_TABLE)
      .select("user_id, lead_id, created_at")
      .eq(USAGE_EVENT_COLUMNS.eventType, scannedType)
      .in(USAGE_EVENT_COLUMNS.userId, userChunk)
      .in(USAGE_EVENT_COLUMNS.leadId, placeIds)
      .order(USAGE_EVENT_COLUMNS.createdAt, { ascending: true });

    if (scanError) {
      return { rows: [], error: scanError.message };
    }

    for (const row of scanRows ?? []) {
      const userId = typeof row.user_id === "string" ? row.user_id : "";
      const placeId =
        typeof row.lead_id === "string" ? row.lead_id.trim() : "";
      const createdAt =
        typeof row.created_at === "string" ? row.created_at : "";
      if (!userId || !placeId || !createdAt) continue;
      const key = `${userId}::${placeId}`;
      const list = scanByKey.get(key) ?? [];
      list.push(createdAt);
      scanByKey.set(key, list);
    }
  }

  const businessByPlace = new Map<
    string,
    { name: string | null; phone: string | null; city: string | null; state: string | null }
  >();
  for (const placeChunk of chunk(placeIds, 80)) {
    const { data: businesses, error: bizError } = await admin
      .from("businesses_nowebsite")
      .select("place_id, name, phone, city, state")
      .in("place_id", placeChunk);
    if (bizError) {
      return { rows: [], error: bizError.message };
    }
    for (const b of businesses ?? []) {
      const placeId = typeof b.place_id === "string" ? b.place_id : "";
      if (!placeId) continue;
      businessByPlace.set(placeId, {
        name: typeof b.name === "string" ? b.name : null,
        phone: typeof b.phone === "string" ? b.phone : null,
        city: typeof b.city === "string" ? b.city : null,
        state: typeof b.state === "string" ? b.state : null,
      });
    }
  }

  const emailByUser = new Map<string, string | null>();
  for (const userChunk of chunk(userIds, 80)) {
    const { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select("id, email")
      .in("id", userChunk);
    if (profileError) {
      return { rows: [], error: profileError.message };
    }
    for (const p of profiles ?? []) {
      const id = typeof p.id === "string" ? p.id : "";
      if (!id) continue;
      emailByUser.set(id, typeof p.email === "string" ? p.email : null);
    }
  }

  const rows: AdminPostcardRow[] = [];
  for (const send of sends) {
    const key = `${send.userId}::${send.placeId}`;
    const scans = scanByKey.get(key) ?? [];
    const scannedAt =
      scans.find((at) => at >= send.sentAt) ?? null;

    if (input.status === "scanned" && !scannedAt) continue;
    if (input.status === "unscanned" && scannedAt) continue;

    const biz = businessByPlace.get(send.placeId);
    rows.push({
      sendId: send.id,
      userId: send.userId,
      placeId: send.placeId,
      sentAt: send.sentAt,
      scannedAt,
      businessName: biz?.name ?? null,
      phone: biz?.phone ?? null,
      city: biz?.city ?? null,
      state: biz?.state ?? null,
      senderEmail: emailByUser.get(send.userId) ?? null,
    });
  }

  return { rows, error: null };
}
