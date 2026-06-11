const SEARCH_ENGINE_BOTS = [
  /googlebot/i,
  /bingbot/i,
  /slurp/i,
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /applebot/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
];

const SCRIPT_USER_AGENTS = [
  /^curl\//i,
  /^wget\//i,
  /python-requests/i,
  /python-urllib/i,
  /^scrapy\//i,
  /^httpx\//i,
  /^go-http-client/i,
  /^java\//i,
  /^libwww-perl/i,
  /^axios\//i,
  /^node-fetch/i,
  /^undici/i,
];

export function isSearchEngineBot(userAgent: string | null): boolean {
  if (!userAgent?.trim()) return false;
  return SEARCH_ENGINE_BOTS.some((pattern) => pattern.test(userAgent));
}

export function isScriptUserAgent(userAgent: string | null): boolean {
  if (!userAgent?.trim()) return true;
  return SCRIPT_USER_AGENTS.some((pattern) => pattern.test(userAgent));
}

export function shouldBypassRateLimit(userAgent: string | null): boolean {
  return isSearchEngineBot(userAgent);
}
