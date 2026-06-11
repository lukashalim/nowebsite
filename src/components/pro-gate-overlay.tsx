import { Lock } from "lucide-react";
import { UpgradeToProButton } from "@/components/upgrade-to-pro-button";

interface ProGateOverlayProps {
  title?: string;
  description?: string;
  className?: string;
}

export function ProGateOverlay({
  title = "Pro feature",
  description = "Upgrade to unlock CSV export, DM spintax, and demo pages.",
  className = "",
}: ProGateOverlayProps) {
  return (
    <div
      className={`absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/60 p-6 backdrop-blur-sm dark:bg-zinc-950/60 ${className}`}
    >
      <div className="max-w-sm rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        <Lock
          className="mx-auto size-8 text-zinc-400 dark:text-zinc-500"
          aria-hidden
        />
        <h2 className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
        <div className="mt-4">
          <UpgradeToProButton />
        </div>
      </div>
    </div>
  );
}

interface ProFeatureLockProps {
  label?: string;
}

export function ProFeatureLock({ label = "Pro" }: ProFeatureLockProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
      title="Upgrade to Pro to unlock"
    >
      <Lock className="size-3" aria-hidden />
      {label}
    </span>
  );
}
