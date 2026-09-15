"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import {
  trackClickToCall,
  trackOutboundClick,
  type ClientSiteCallLocation,
} from "@/lib/analytics";

type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick">;

interface ClientSiteCallLinkProps extends AnchorProps {
  href: string;
  siteId: string;
  location: ClientSiteCallLocation;
  children: ReactNode;
}

export function ClientSiteCallLink({
  href,
  siteId,
  location,
  children,
  ...rest
}: ClientSiteCallLinkProps) {
  return (
    <a
      href={href}
      onClick={() => trackClickToCall(siteId, location)}
      {...rest}
    >
      {children}
    </a>
  );
}

interface ClientSiteOutboundLinkProps extends AnchorProps {
  href: string;
  siteId: string;
  label: string;
  location?: string;
  children: ReactNode;
}

export function ClientSiteOutboundLink({
  href,
  siteId,
  label,
  location = "contact",
  children,
  ...rest
}: ClientSiteOutboundLinkProps) {
  return (
    <a
      href={href}
      onClick={() => trackOutboundClick(siteId, label, location)}
      {...rest}
    >
      {children}
    </a>
  );
}
