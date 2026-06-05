import type { Metadata } from "next";
import Link from "next/link";
import { CRM_BASE_PATH } from "@/lib/crm-path";

export const metadata: Metadata = {
  title: "Sign-in error",
  robots: { index: false, follow: false },
};

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Sign-in failed
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          We could not complete Google sign-in. Please try again.
        </p>
        <Link
          href={CRM_BASE_PATH}
          className="inline-block text-sm font-medium text-blue-600 underline hover:text-blue-700 dark:text-blue-400"
        >
          Back to CRM
        </Link>
      </div>
    </div>
  );
}
