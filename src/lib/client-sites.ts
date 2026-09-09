/** Live trial websites on custom domains, served from this app by Host header. */

export const CLIENT_SITE_DEV_PORT = "3002";

export interface ClientSiteService {
  title: string;
  description: string;
}

export interface ClientSite {
  id: string;
  name: string;
  title: string;
  description: string;
  tagline: string;
  about: string;
  areaServed: string;
  origin: string;
  hosts: string[];
  placeId: string;
  services: ClientSiteService[];
}

export const CLIENT_SITES: ClientSite[] = [
  {
    id: "somers-lawn-tree",
    name: "Somers Lawn & Tree",
    title:
      "Somers Lawn & Tree | Lawn Care & Tree Service in Washington Court House, OH",
    description:
      "Lawn care, tree service, landscaping, and firewood in Washington Court House, Ohio. Call Tom Somers at (740) 463-8025.",
    tagline: "Lawn care, tree service, landscaping & firewood",
    about:
      "Somers Lawn & Tree is a local lawn care, tree service, landscaping, and firewood company based in Washington Court House, Ohio. Owner Tom Somers and his crew are known for fair prices, careful cleanup, and doing the job when they say they will — from tree work and brush piles to mowing and firewood.",
    areaServed:
      "Washington Court House, Fayette County, and nearby communities in Ohio.",
    origin: "https://somerslawntree.com",
    hosts: ["somerslawntree.com", "www.somerslawntree.com"],
    placeId: "ChIJERB6J7pIR4gRScYINHwAvu0",
    services: [
      {
        title: "Tree Service",
        description:
          "Removals, dead limbs, and clean work around homes, animals, and tight yards.",
      },
      {
        title: "Lawn Care",
        description:
          "Mowing and yard work that leaves the property looking finished.",
      },
      {
        title: "Landscaping",
        description:
          "Brush piles, shrub and bush removal, and garden prep — including the jobs others skip.",
      },
      {
        title: "Firewood",
        description:
          "A ready supply of firewood, including when Ohio weather turns quickly.",
      },
    ],
  },
];

function getHostPort(host: string): string | null {
  const lastColon = host.lastIndexOf(":");
  if (lastColon === -1) return null;
  return host.slice(lastColon + 1);
}

export function hostnameFromHost(host: string): string {
  return host.split(":")[0]?.toLowerCase() ?? "";
}

export function getClientSiteById(id: string): ClientSite | null {
  const normalized = id.trim().toLowerCase();
  return CLIENT_SITES.find((site) => site.id === normalized) ?? null;
}

export function getClientSiteByHost(host: string): ClientSite | null {
  const hostname = hostnameFromHost(host);
  const match = CLIENT_SITES.find((site) => site.hosts.includes(hostname));
  if (match) return match;
  if (
    process.env.NODE_ENV === "development" &&
    getHostPort(host) === CLIENT_SITE_DEV_PORT
  ) {
    return CLIENT_SITES[0] ?? null;
  }
  return null;
}

export function isClientSiteHost(host: string): boolean {
  return getClientSiteByHost(host) !== null;
}

export function clientSiteApexHostname(site: ClientSite): string {
  return new URL(site.origin).hostname;
}

function normalizePathname(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

export function isClientSiteAllowedPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  if (normalized === "/") return true;
  if (pathname.startsWith("/_next/")) return true;
  if (normalized === "/favicon.ico") return true;
  if (normalized === "/robots.txt") return true;
  if (normalized === "/sitemap.xml") return true;
  if (normalized.includes("opengraph-image")) return true;
  if (normalized.includes("twitter-image")) return true;
  if (normalized === "/icon" || normalized.startsWith("/icon.")) return true;
  if (normalized.startsWith("/apple-icon")) return true;
  return false;
}
