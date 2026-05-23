import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarHeart,
  ChefHat,
  Droplets,
  Hammer,
  Paintbrush,
  PartyPopper,
  Scissors,
  Sparkles,
  Stethoscope,
  UtensilsCrossed,
  Wrench,
  Zap,
} from "lucide-react";
import { formatCategoryDisplayName } from "@/lib/directory/labels";

interface CategoryIconRule {
  test: RegExp;
  Icon: LucideIcon;
}

const CATEGORY_ICON_RULES: CategoryIconRule[] = [
  { test: /paint/i, Icon: Paintbrush },
  { test: /plumb/i, Icon: Droplets },
  { test: /salon|barber|hair/i, Icon: Scissors },
  { test: /spa|massage|wellness/i, Icon: Sparkles },
  { test: /restaurant|food|cafe|dining|chef/i, Icon: ChefHat },
  { test: /cater/i, Icon: UtensilsCrossed },
  { test: /event|party|wedding/i, Icon: PartyPopper },
  { test: /electric/i, Icon: Zap },
  { test: /appliance|hvac|repair|contractor|handyman/i, Icon: Wrench },
  { test: /construct|remodel|roof|floor/i, Icon: Hammer },
  { test: /dent|medical|clinic|doctor/i, Icon: Stethoscope },
  { test: /fitness|gym|yoga/i, Icon: CalendarHeart },
];

export function resolveCategoryIcon(categoryLabel: string): LucideIcon {
  const normalized = formatCategoryDisplayName(categoryLabel).toLowerCase();
  const slugish = categoryLabel.trim().toLowerCase().replace(/[_-]+/g, " ");
  const haystack = `${normalized} ${slugish}`;

  for (const { test, Icon } of CATEGORY_ICON_RULES) {
    if (test.test(haystack)) return Icon;
  }
  return Building2;
}

interface CategoryIconProps {
  categoryLabel: string;
  className?: string;
}

export function CategoryIcon({ categoryLabel, className }: CategoryIconProps) {
  const Icon = resolveCategoryIcon(categoryLabel);
  return <Icon className={className} aria-hidden />;
}
