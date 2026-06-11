interface CrmLoadErrorProps {
  message: string;
}

export function CrmLoadError({ message }: CrmLoadErrorProps) {
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
      role="alert"
    >
      <p className="font-medium">Could not load data</p>
      <p className="mt-1 opacity-90">{message}</p>
      <p className="mt-2 text-xs opacity-80">
        Set{" "}
        <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">
          NEXT_PUBLIC_SUPABASE_URL
        </code>{" "}
        and{" "}
        <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">
          SUPABASE_SERVICE_ROLE_KEY
        </code>{" "}
        in{" "}
        <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">
          .env.local
        </code>
        .
      </p>
    </div>
  );
}
