/** Shared demo review shape — keep in a module with no server-only imports so client components can import it safely. */
export interface DemoReviewHighlight {
  rating?: number;
  excerpt: string;
  relative_time?: string;
  reviewer_name?: string;
}
