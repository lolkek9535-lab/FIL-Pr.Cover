/**
 * The HTTP server is meant for the developer's own browser. Unless a host is
 * configured explicitly, only loopback clients addressing a local hostname are
 * served, which keeps other devices on the network and DNS-rebinding pages out.
 */
export function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  const value = address.startsWith("::ffff:") ? address.slice(7) : address;
  return value === "::1" || value === "127.0.0.1" || /^127\.\d+\.\d+\.\d+$/.test(value);
}

export function isLoopbackHost(host: string): boolean {
  const value = host.trim().toLowerCase();
  return value === "localhost" || value === "::1" || value === "[::1]" || /^127\.\d+\.\d+\.\d+$/.test(value);
}

export function isLocalHostHeader(header: string | undefined, allowed: string[] = []): boolean {
  if (!header) return true; // HTTP/1.0 clients; the socket check still applies.
  let hostname = header.trim().toLowerCase();
  if (hostname.startsWith("[")) hostname = hostname.slice(0, hostname.indexOf("]") + 1);
  else hostname = hostname.replace(/:\d+$/, "");
  if (hostname.endsWith(".localhost")) return true;
  return isLoopbackHost(hostname) || allowed.map(h => h.toLowerCase()).includes(hostname);
}
