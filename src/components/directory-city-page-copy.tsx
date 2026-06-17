import Link from "next/link";
import {
  cityHubAboutCopy,
  cityHubRevealCopy,
  type CityHubAboutCopy,
  type CityHubRevealCopy,
} from "@/lib/directory/labels";

const bodyClass =
  "text-sm leading-relaxed text-zinc-600 dark:text-zinc-400";

interface DirectoryCityRevealCopyProps {
  place: string;
  count: number;
  categoryCount?: number;
}

export function DirectoryCityRevealCopy({
  place,
  count,
  categoryCount,
}: DirectoryCityRevealCopyProps) {
  const copy: CityHubRevealCopy = cityHubRevealCopy(place, count, categoryCount);

  return (
    <div className={`max-w-2xl space-y-3 ${bodyClass}`}>
      <p>{copy.whyHere}</p>
      <p>{copy.howToLeverage}</p>
      {copy.segmentationNote ? <p>{copy.segmentationNote}</p> : null}
    </div>
  );
}

interface DirectoryProspectingAboutDataProps {
  place: string;
  copy?: CityHubAboutCopy;
}

export function DirectoryProspectingAboutData({
  place,
  copy,
}: DirectoryProspectingAboutDataProps) {
  const resolved = copy ?? cityHubAboutCopy(place);

  return (
    <section className="space-y-4 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {resolved.sectionHeading}
      </h2>
      <div className="max-w-2xl space-y-4">
        {resolved.blocks.map((block) => (
          <div key={block.heading} className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {block.heading}
            </h3>
            <p className={bodyClass}>
              {block.heading === "Data methodology" ? (
                <>
                  {block.body} See our full methodology on the{" "}
                  <Link
                    href="/about"
                    className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-400"
                  >
                    About page
                  </Link>
                  .
                </>
              ) : (
                block.body
              )}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** @deprecated Use DirectoryProspectingAboutData */
export function DirectoryCityAboutData({
  place,
}: {
  place: string;
}) {
  return <DirectoryProspectingAboutData place={place} />;
}
