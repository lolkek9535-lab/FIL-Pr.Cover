import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Origins a developer's own dev server can plausibly run on. Anything else,
 * including the `null` origin of file:// pages, needs AGENTATION_CORS_ORIGINS.
 */
export function isLocalDevOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (!["http:", "https:"].includes(url.protocol)) return false;
  const host = url.hostname.toLowerCase();
  const bare = host.startsWith("[") ? host.slice(1, -1) : host;
  if (bare === "localhost" || bare === "::1" || bare.endsWith(".localhost")) return true;
  if (/^127\.\d+\.\d+\.\d+$/.test(bare)) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(bare) || /^192\.168\.\d+\.\d+$/.test(bare)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(bare)) return true;
  return /\.(local|test|internal)$/.test(bare);
}

export function createCorsPolicy(value = process.env.AGENTATION_CORS_ORIGINS) {
  const entries = value === undefined ? [] : value.split(',').map(s => s.trim()).filter(Boolean);
  const wildcard = entries.length === 1 && entries[0] === '*';
  const localDefault = value === undefined;
  const origins = new Set<string>();
  if (!wildcard) {
    for (const entry of entries) {
      try {
        const url = new URL(entry);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
            url.pathname !== '/' || url.search || url.hash) throw new Error();
        origins.add(url.origin);
      } catch {
        throw new Error('AGENTATION_CORS_ORIGINS must be a comma-separated list of HTTP(S) origins, or * by itself. Regex patterns are not supported.');
      }
    }
  }
  const allowed = (origin: string) => wildcard || origins.has(origin) || (localDefault && isLocalDevOrigin(origin));

  // Run once at the request boundary, before routing, mutations or cloud proxying.
  return (req: IncomingMessage, res: ServerResponse): boolean => {
    const origin = req.headers.origin;
    if (!wildcard) res.setHeader('Vary', 'Origin');
    if (!wildcard && origin !== undefined && !allowed(origin)) return false;
    if (wildcard || origin) res.setHeader('Access-Control-Allow-Origin', wildcard ? '*' : origin!);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    return true;
  };
}
