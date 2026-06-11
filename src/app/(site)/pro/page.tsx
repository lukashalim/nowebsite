import type { Metadata } from "next";
import Link from "next/link";
import {
  LayoutTemplate,
  MessageSquareText,
  Star,
  Workflow,
} from "lucide-react";
import { UpgradeToProButton } from "@/components/upgrade-to-pro-button";
import { ManageSubscriptionButton } from "@/components/manage-subscription-button";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { FREE_MONTHLY_OUTREACH_LIMIT } from "@/lib/crm-limits";
import { absoluteUrl } from "@/lib/site-url";
import { getUserProfile, isPro } from "@/lib/subscription";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Pro CRM for Web Designers | No Website Business Leads",
  description:
    "Free CRM for no-website local business leads (25 outreach actions/month). Pro adds unlimited outreach and full CSV export.",
  alternates: { canonical: absoluteUrl("/pro") },
};

const features = [
  {
    icon: Workflow,
    title: "Contact stage tracking",
    description:
      "Track outreach attempts per lead in a sortable table with filters for reviews, rating, and web presence.",
  },
  {
    icon: Star,
    title: "Review excerpts",
    description:
      "See extracted Google Maps review highlights to personalize outreach and build demo pages faster.",
  },
  {
    icon: MessageSquareText,
    title: "DM spintax generator",
    description:
      "Generate Facebook DM variations for leads whose Maps listing points to Facebook.",
  },
  {
    icon: LayoutTemplate,
    title: "Demo page builder",
    description:
      "Publish SEO-friendly demo pages per business so prospects can preview a site before you pitch.",
  },
];

export default async function ProPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user ? await getUserProfile(user.id) : null;
  const userIsPro = isPro(profile);

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Pro CRM for web designers & agencies
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          Start free with {FREE_MONTHLY_OUTREACH_LIMIT} outreach actions per
          month, then upgrade when you need unlimited DMs, SMS, demo links, and
          full CSV export — all on the same no-website lead dataset as this
          public directory.
        </p>
      </section>

      <ul className="grid gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <li
            key={f.title}
            className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
          >
            <f.icon className="size-5 text-zinc-500" aria-hidden />
            <h2 className="mt-3 font-semibold text-zinc-900 dark:text-zinc-100">
              {f.title}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {f.description}
            </p>
          </li>
        ))}
      </ul>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Pricing
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Free
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              $0
              <span className="text-lg font-normal text-zinc-600 dark:text-zinc-400">
                /month
              </span>
            </p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Full CRM access — your first {FREE_MONTHLY_OUTREACH_LIMIT} outreach
              actions each month are on us.
            </p>
            <ul className="mt-4 flex-1 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              <li>
                {FREE_MONTHLY_OUTREACH_LIMIT} DMs, SMS, or demo link clicks per
                month
              </li>
              <li>Browse and filter all no-website leads</li>
              <li>Contact stage tracking & review excerpts</li>
              <li>CSV export for the current CRM page</li>
            </ul>
            <div className="mt-6">
              {user ? (
                <Link
                  href={CRM_BASE_PATH}
                  className="inline-flex w-full items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  {userIsPro ? "Open CRM" : "Open free CRM"}
                </Link>
              ) : (
                <Link
                  href="/sign-in"
                  className="inline-flex w-full items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  Sign in — start free
                </Link>
              )}
            </div>
          </div>

          <div className="flex flex-col rounded-xl border border-blue-200 bg-blue-50/50 p-6 dark:border-blue-900/50 dark:bg-blue-950/20">
            <p className="text-sm font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">
              Pro
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              $27
              <span className="text-lg font-normal text-zinc-600 dark:text-zinc-400">
                /month
              </span>
            </p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              For agencies and power users who outreach at volume.
            </p>
            <ul className="mt-4 flex-1 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              <li>Everything in Free</li>
              <li>Unlimited DMs, SMS, and demo link clicks</li>
              <li>Full-filter CSV export (all matching leads)</li>
              <li>Spintax template editor</li>
            </ul>
            <div className="mt-6 flex flex-col gap-2">
              {userIsPro ? (
                <>
                  <Link
                    href={CRM_BASE_PATH}
                    className="inline-flex w-full items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Open CRM
                  </Link>
                  <ManageSubscriptionButton />
                </>
              ) : user ? (
                <UpgradeToProButton className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600" />
              ) : (
                <Link
                  href="/sign-in"
                  className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  Sign in to upgrade
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
