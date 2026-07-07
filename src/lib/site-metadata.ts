import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site-url";

const SITE_NAME = "No Website Business Leads";

export function directoryOpenGraph(opts: {
  title: string;
  description: string;
  path: string;
}): Pick<Metadata, "openGraph" | "twitter"> {
  const url = absoluteUrl(opts.path);
  return {
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      siteName: SITE_NAME,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
    },
  };
}
