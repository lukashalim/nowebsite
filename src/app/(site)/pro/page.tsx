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
import { absoluteUrl } from "@/lib/site-url";
import { getUserProfile, isPro } from "@/lib/subscription";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Pro CRM for Web Designers | No Website Business Leads",
  description:
    "Full CRM for no-website local business leads: contact stage tracking, review excerpts, DM spintax, and demo page builder.",
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
          Everything on the private outreach workspace: filter thousands of
          no-website leads, log contacts, generate spintax, and ship demo pages
          — built on the same Supabase dataset as this public directory.
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

      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Pricing
        </h2>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          $27<span className="text-lg font-normal text-zinc-600 dark:text-zinc-400">/month</span>
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          CSV export, DM spintax, and demo page links from your pipeline.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {userIsPro ? (
            <>
              <Link
                href={CRM_BASE_PATH}
                className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Open CRM
              </Link>
              <ManageSubscriptionButton />
            </>
          ) : user ? (
            <UpgradeToProButton />
          ) : (
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Sign in to upgrade
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
