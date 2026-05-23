export interface ExtractStartOptions {
  businessType?: string;
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
