export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "free-google-maps-data",
    title: "Free Google Maps Data: No Scrapers, No Proxies, Just Clean CSVs",
    description:
      "Skip scraper setup, proxies, and broken exports. Browse pre-filtered no-website leads and download clean CSVs free.",
    publishedAt: "2026-06-01",
  },
  {
    slug: "grapeleads-alternative",
    title:
      "The Best GrapeLeads Alternative for Finding Businesses Without Websites",
    description:
      "Compare Outreach Engine vs GrapeLeads — live lead data, in-UI Spintax DMs, and demo sites without broken export queues.",
    publishedAt: "2026-06-01",
  },
];

export function blogPostPath(slug: string): string {
  return `/blog/${slug}`;
}

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function getBlogPostsNewestFirst(): BlogPost[] {
  return [...BLOG_POSTS].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}
