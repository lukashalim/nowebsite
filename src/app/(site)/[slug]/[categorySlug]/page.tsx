import { permanentRedirect } from "next/navigation";
import { fetchAllValidCityCategorySlugs } from "@/lib/directory/data";
import { parseCategorySlug } from "@/lib/directory/slugs";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string; categorySlug: string }>;
}

export async function generateStaticParams() {
  try {
    return await fetchAllValidCityCategorySlugs();
  } catch {
    return [];
  }
}

/** Legacy city-scoped category URLs → nationwide category page. */
export default async function LegacyCityCategoryRedirect({ params }: PageProps) {
  const { categorySlug } = await params;
  if (!parseCategorySlug(categorySlug)) {
    permanentRedirect("/");
  }
  permanentRedirect(`/${categorySlug}`);
}
