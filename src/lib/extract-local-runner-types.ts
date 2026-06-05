export interface ExtractStartOptions {
  businessType?: string;
  /** US, GB, or AU — sets EXTRACT_LOCAL_COUNTRY for the ingest script. */
  country?: "US" | "GB" | "AU";
  /** US ZIP, UK postcode, or AU 4-digit postcode for locality fallback when NDJSON lacks city. */
  locationHint?: string;
  dryRun?: boolean;
  keepFiles?: boolean;
  includeTasks?: boolean;
  maxFiles?: number;
}

export interface ExtractRunnerSnapshot {
  running: boolean;
  pid: number | null;
  startedAt: string | null;
  exitCode: number | null;
  logTail: string[];
  options: ExtractStartOptions | null;
}
