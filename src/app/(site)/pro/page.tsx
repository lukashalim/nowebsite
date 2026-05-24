import type { Metadata } from "next";
import {
  LayoutTemplate,
  MessageSquareText,
  Star,
  Workflow,
} from "lucide-react";
import { absoluteUrl } from "@/lib/site-url";

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

export default function ProPage() {
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Pro CRM for web designers & agencies
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          Everything on the private outreach workspace (formerly ringreadysite.com):
          filter thousands of no-website leads, log contacts, generate spintax, and
          ship demo pages — built on the same Supabase dataset as this public directory.
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

      <section className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900/40">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Pricing
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Coming soon. Want early access? Email{" "}
          <a
            href="mailto:lukas@nowebsitebusinessleads.com"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            lukas@nowebsitebusinessleads.com
          </a>{" "}
          and we&apos;ll notify you when Pro launches.
        </p>
      </section>
    </div>
  );
}
