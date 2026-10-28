/**
 * safe-fetch.ts — download a user-given URL without letting it reach this machine or its network (server only).
 *   - https only, on EVERY hop: redirects are followed by hand (max 5) and each target is checked again;
 *   - the address is checked when the socket connects (custom DNS lookup), so a name cannot switch to a private address
 *     between a check and the connection (DNS rebinding): loopback, private, link-local, CGNAT, multicast, unspecified,
 *     IPv6 outside global unicast, IPv4-mapped/NAT64/6to4/Teredo forms are refused (privateIp: parsed bytes, allow-list);
 *   - the body is counted while it streams and the download stops at `max` bytes;
 *   - optional host allow-list (e.g. only Poly Haven's own hosts for its model files).
 */
import { lookup as dnsLookup } from "node:dns";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";

// Address policy = ALLOW-list, decided on parsed bytes (text prefixes miss forms like ::ffff:7f00:1 = 127.0.0.1).
// IPv4: public unicast only. IPv6: global unicast 2000::/3 only, minus ranges that embed or tunnel an IPv4 address or are
// reserved (6to4 2002::/16, Teredo 2001::/32, documentation 2001:db8::/32, ORCHIDv2 2001:20::/28); an IPv4-mapped
// address (::ffff:a.b.c.d, any spelling) is judged as that IPv4. Everything else (::, ::1, ::/96, 64:ff9b::/96, fc00::/7,
// fe80::/10, fec0::/10, ff00::/8, …) is refused because it lies outside 2000::/3.
function v4Blocked(b: number[]): boolean {
  const [a, c] = b;
  return a === 0 || a === 10 || a === 127 || (a === 100 && c >= 64 && c <= 127) || (a === 169 && c === 254) || (a === 172 && c >= 16 && c <= 31)
    || (a === 192 && c === 168) || (a === 192 && c === 0 && b[2] === 0) || (a === 192 && c === 0 && b[2] === 2) || (a === 198 && (c === 18 || c === 19))
    || (a === 198 && c === 51 && b[2] === 100) || (a === 203 && c === 0 && b[2] === 113) || a >= 224;
}
function v6Bytes(ip: string): number[] | null {
  let s = ip.toLowerCase().replace(/^\[|\]$/g, "").replace(/%.*$/, "");   // brackets, zone id
  // A trailing dotted IPv4 (::ffff:1.2.3.4, ::1.2.3.4) becomes two hex groups, so every form parses the same way.
  const dot = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (dot) {
    const q = dot.slice(1).map(Number); if (q.some((x) => x > 255)) return null;
    s = s.slice(0, dot.index) + ((q[0] << 8) | q[1]).toString(16) + ":" + ((q[2] << 8) | q[3]).toString(16);
  }
  const halves = s.split("::"); if (halves.length > 2) return null;
  const parse = (h: string) => (h ? h.split(":") : []).map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  const head = parse(halves[0]), back = halves.length === 2 ? parse(halves[1]) : [];
  if ([...head, ...back].some(Number.isNaN)) return null;
  const zeros = 8 - head.length - back.length;
  if (halves.length === 2 ? zeros < 1 : zeros !== 0) return null;
  return [...head, ...Array(halves.length === 2 ? zeros : 0).fill(0), ...back].flatMap((x) => [x >> 8, x & 255]);
}
export function privateIp(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, "");
  if (isIP(bare) === 4) return v4Blocked(bare.split(".").map(Number));
  if (isIP(bare) !== 6) return true;                                    // not an address we understand → refuse
  const b = v6Bytes(bare); if (!b) return true;
  if (b.slice(0, 10).every((x) => x === 0) && b[10] === 255 && b[11] === 255) return v4Blocked(b.slice(12));   // ::ffff:a.b.c.d
  if ((b[0] & 0xe0) !== 0x20) return true;                              // outside 2000::/3
  if (b[0] === 0x20 && b[1] === 0x02) return true;                      // 6to4
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0 && b[3] === 0) return true;          // Teredo
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return true;    // documentation
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0 && (b[3] & 0xf0) === 0x20) return true; // ORCHIDv2
  return false;
}
const guardedLookup: LookupFunction = (host, opts, cb) => {
  dnsLookup(host, { ...opts, all: true }, (err, addrs) => {
    if (err) return cb(err, "", 0);
    const list = addrs as unknown as { address: string; family: number }[];
    const bad = list.find((a) => privateIp(a.address));
    if (bad || !list.length) return cb(new Error(`refused address for ${host}`), "", 0);
    // Node asks for one address unless opts.all; answer in the shape it asked for.
    if ((opts as { all?: boolean }).all) return (cb as unknown as (e: null, a: typeof list) => void)(null, list);
    cb(null, list[0].address, list[0].family);
  });
};

export async function safeGet(url: string, opts: { max: number; hosts?: RegExp; headers?: Record<string, string> }): Promise<Uint8Array> {
  let u = new URL(url);
  for (let hop = 0; hop <= 5; hop++) {
    if (u.protocol !== "https:") throw new Error("only https:// links can be downloaded");
    if (opts.hosts && !opts.hosts.test(u.hostname)) throw new Error(`downloads from ${u.hostname} are not allowed here`);
    if (isIP(u.hostname.replace(/^\[|\]$/g, "")) && privateIp(u.hostname.replace(/^\[|\]$/g, ""))) throw new Error("refused address");
    const res = await new Promise<{ status: number; location?: string; body?: Uint8Array }>((resolve, reject) => {
      const req = https.get(u, { headers: opts.headers, lookup: guardedLookup, timeout: 60_000 }, (r) => {
        const status = r.statusCode ?? 0;
        if (status >= 300 && status < 400 && r.headers.location) { r.resume(); return resolve({ status, location: r.headers.location }); }
        if (status !== 200) { r.resume(); return reject(new Error(`download failed (${status})`)); }
        const len = Number(r.headers["content-length"] || 0);
        if (len > opts.max) { r.destroy(); return reject(new Error(`that file is larger than ${Math.round(opts.max / 1e6)} MB`)); }
        const parts: Buffer[] = []; let n = 0;
        r.on("data", (c: Buffer) => { n += c.length; if (n > opts.max) { r.destroy(); reject(new Error(`that file is larger than ${Math.round(opts.max / 1e6)} MB`)); } else parts.push(c); });
        r.on("end", () => resolve({ status, body: new Uint8Array(Buffer.concat(parts)) }));
        r.on("error", reject);
      });
      req.on("timeout", () => req.destroy(new Error("download timed out")));
      req.on("error", reject);
    });
    if (res.body) return res.body;
    u = new URL(res.location!, u);   // relative redirects resolve against the current hop
  }
  throw new Error("too many redirects");
}
