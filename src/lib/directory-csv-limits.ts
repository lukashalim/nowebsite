export const FREE_MONTHLY_DIRECTORY_CSV_LIMIT = 5;

export interface DirectoryCsvDownloadSummary {
  used: number;
  remaining: number;
  limit: number;
  periodEnd: string;
}
