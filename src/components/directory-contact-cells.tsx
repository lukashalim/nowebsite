"use client";

import { ExternalLink, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import type { DirectoryContactAccess } from "@/lib/directory/contact-fields";
import type { DirectoryContactRow } from "@/lib/directory/contact-fields";
import { fetchDirectoryContacts } from "@/lib/directory/contact-api-client";

function contactForRow(
  contacts: DirectoryContactRow[] | null,
  rowIndex: number,
): DirectoryContactRow | undefined {
  return contacts?.find((c) => c.i === rowIndex);
}

interface DirectoryPhoneCellProps {
  rowIndex: number;
  contacts: DirectoryContactRow[] | null;
  loading: boolean;
}

export function DirectoryPhoneCell({
  rowIndex,
  contacts,
  loading,
}: DirectoryPhoneCellProps) {
  const phone = contactForRow(contacts, rowIndex)?.phone;

  if (loading) {
    return (
      <td className="px-4 py-3">
        <span className="inline-block h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </td>
    );
  }

  return (
    <td className="px-4 py-3">
      {phone ? (
        <a
          href={`tel:${phone.replace(/\s/g, "")}`}
          className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
        >
          <Phone className="size-3.5" aria-hidden />
          {phone}
        </a>
      ) : (
        "—"
      )}
    </td>
  );
}

interface DirectoryMapsCellProps {
  rowIndex: number;
  contacts: DirectoryContactRow[] | null;
  loading: boolean;
}

export function DirectoryMapsCell({
  rowIndex,
  contacts,
  loading,
}: DirectoryMapsCellProps) {
  const mapsLink = contactForRow(contacts, rowIndex)?.google_maps_link;

  if (loading) {
    return (
      <td className="px-4 py-3">
        <span className="inline-block h-4 w-12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </td>
    );
  }

  return (
    <td className="px-4 py-3">
      {mapsLink ? (
        <a
          href={mapsLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-blue-600 hover:underline dark:text-blue-400"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          Maps
        </a>
      ) : (
        "—"
      )}
    </td>
  );
}

interface DirectoryContactProviderProps {
  access: DirectoryContactAccess;
  rowCount: number;
  children: (ctx: {
    contacts: DirectoryContactRow[] | null;
    loading: boolean;
  }) => React.ReactNode;
}

export function DirectoryContactProvider({
  access,
  rowCount,
  children,
}: DirectoryContactProviderProps) {
  const [contacts, setContacts] = useState<DirectoryContactRow[] | null>(null);
  const [loading, setLoading] = useState(rowCount > 0);
  const accessKey = `${access.scope}:${access.page}:${access.token.slice(0, 12)}`;

  useEffect(() => {
    if (rowCount === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchDirectoryContacts(access)
      .then((rows) => {
        if (!cancelled) {
          setContacts(rows);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContacts([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [access, accessKey, rowCount]);

  return <>{children({ contacts, loading })}</>;
}
