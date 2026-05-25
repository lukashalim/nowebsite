export interface ExtractStartOptions {
  businessType?: string;
  /** US or GB — sets EXTRACT_LOCAL_COUNTRY for the ingest script. */
  country?: "US" | "GB";
  /** US ZIP or UK postcode for locality fallback when NDJSON lacks city. */
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
