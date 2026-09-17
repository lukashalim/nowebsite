import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Building2,
  Heart,
  Home,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import type { CategoryGroupId } from "@/lib/directory/category-group-ids";

const GROUP_ICONS: Record<CategoryGroupId, LucideIcon> = {
  "home-services-high-opportunity": Zap,
  "home-services": Home,
  "food-hospitality": UtensilsCrossed,
  professional: Briefcase,
  "health-wellness": Heart,
  other: Building2,
};

interface CategoryGroupIconProps {
  groupId: CategoryGroupId;
  className?: string;
}

export function CategoryGroupIcon({ groupId, className }: CategoryGroupIconProps) {
  const Icon = GROUP_ICONS[groupId];
  return <Icon className={className} aria-hidden />;
}
