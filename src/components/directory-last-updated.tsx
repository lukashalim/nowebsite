interface DirectoryLastUpdatedProps {
  label: string | null;
}

export function DirectoryLastUpdated({ label }: DirectoryLastUpdatedProps) {
  if (!label) return null;
  return (
    <p className="text-right text-sm text-gray-400 dark:text-zinc-500">
      Last updated: {label}
    </p>
  );
}
