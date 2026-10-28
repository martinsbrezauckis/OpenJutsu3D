// zip_guard_test.mts — lib/packs.ts unzip(): a "decompression bomb" entry (claims 100 bytes, inflates to 10 MB) must be
// refused; an honest entry must extract. Run: node bench/zip_guard_test.mts (offline; copies lib to web/.cost-test)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"; import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url";
import { deflateRawSync, crc32 } from "node:zlib";
const web = join(dirname(fileURLToPath(import.meta.url)), "..", "web"), scratch = join(web, ".cost-test"); mkdirSync(scratch, { recursive: true });
for (const f of ["packs", "render", "gltf-pack", "safe-fetch"]) writeFileSync(join(scratch, `${f}.ts`), readFileSync(join(web, "lib", `${f}.ts`), "utf8").replace(/from "\.\/(packs|render|gltf-pack|safe-fetch)"/g, 'from "./$1.ts"'));
const { unzip } = await import(join(scratch, "packs.ts"));
function zip(entries: { name: string; data: Uint8Array; claim?: number }[]) {
  const local: Buffer[] = [], central: Buffer[] = []; let off = 0;
  for (const e of entries) {
    const c = deflateRawSync(e.data), n = Buffer.from(e.name), usize = e.claim ?? e.data.length, crc = crc32(e.data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(c.length, 18); lh.writeUInt32LE(usize, 22); lh.writeUInt16LE(n.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(c.length, 20); ch.writeUInt32LE(usize, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(off, 42);
    local.push(lh, n, c); central.push(ch, n); off += 30 + n.length + c.length;
  }
  const cd = Buffer.concat(central), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(entries.length, 8); e.writeUInt16LE(entries.length, 10);
  e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...local, cd, e]));
}
const z = unzip(zip([{ name: "ok.glb", data: new Uint8Array(5000).fill(7) }, { name: "bomb.glb", data: new Uint8Array(10_000_000), claim: 100 },
  { name: "../escape.glb", data: new Uint8Array(10) }]));
const res: Record<string, boolean> = {};
res["honest entry extracts"] = z.get("ok.glb")?.().length === 5000;
try { z.get("bomb.glb")!(); res["bomb refused"] = false; } catch (e) { res["bomb refused"] = true; console.log(" bomb:", (e as Error).message.slice(0, 90)); }
res["path escape dropped"] = !z.has("../escape.glb");
console.log(JSON.stringify(res)); process.exit(Object.values(res).every(Boolean) ? 0 : 1);
