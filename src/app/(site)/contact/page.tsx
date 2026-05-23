import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site-url";

const CONTACT_EMAIL = "lukas@nowebsitebusinessleads.com";

export const metadata: Metadata = {
  title: "Contact | No Website Business Leads",
  description:
    "Get in touch with questions, feedback, or to learn about Pro access.",
  alternates: { canonical: absoluteUrl("/contact") },
};

export default function ContactPage() {
  return (
    <article className="mx-auto max-w-lg space-y-4 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Contact
      </h1>
      <p className="text-base text-zinc-600 dark:text-zinc-400">
        Questions, feedback, or interested in Pro access? Get in touch.
      </p>
      <p className="text-lg">
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {CONTACT_EMAIL}
        </a>
      </p>
    </article>
  );
}
