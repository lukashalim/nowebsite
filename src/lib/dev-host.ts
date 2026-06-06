/** True when the app is running locally (dev server or localhost host). */
export function shouldShowLocalDevTools(host: string): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}
