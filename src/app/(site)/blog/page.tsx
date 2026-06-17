import type { Metadata } from "next";
import Link from "next/link";
import { blogPostPath, getBlogPostsNewestFirst } from "@/lib/blog-posts";
import { absoluteUrl } from "@/lib/site-url";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: { absolute: "Blog | No-Website Leads" },
  description:
    "Guides and comparisons for web designers finding local businesses without websites — free Google Maps data, scraper alternatives, and outreach tips.",
  alternates: { canonical: absoluteUrl("/blog") },
};

function formatPublishedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogIndexPage() {
  const posts = getBlogPostsNewestFirst();

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          Blog
        </h1>
        <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          Practical guides for agencies and freelancers prospecting local
          businesses without websites — lead data, tool comparisons, and
          outreach workflows.
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No posts yet.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {posts.map((post) => (
            <li key={post.slug}>
              <article className="py-6 first:pt-0">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {formatPublishedDate(post.publishedAt)}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  <Link
                    href={blogPostPath(post.slug)}
                    className="transition hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-2 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {post.description}
                </p>
                <Link
                  href={blogPostPath(post.slug)}
                  className="mt-3 inline-block text-sm font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:text-zinc-100"
                >
                  Read article
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
