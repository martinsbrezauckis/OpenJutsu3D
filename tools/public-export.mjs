#!/usr/bin/env node
// public-export.mjs — build the public repository from the allow-list in public-paths.json.
//   node tools/public-export.mjs --check            stage into an empty temp folder + scan, export nothing
//   node tools/public-export.mjs <export-dir>       same, then replace <export-dir>'s working tree with the staged files
//                                                   and commit one snapshot (its git history is kept; created if new)
// Only files tracked by git are candidates (an untracked secret or output can never slip in); a file must match an
// include and no exclude. Every staged text file is scanned for the patterns in tools/export-forbidden.json (private
// paths, hosts, names, attribution trailers; that file is never exported); any hit fails the export — fix the source.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const src = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(src, "public-paths.json"), "utf8"));
const match = (f, p) => (p.endsWith("/") ? f.startsWith(p) : f === p);
const files = execFileSync("git", ["-C", src, "ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean)
  .filter((f) => cfg.include.some((p) => match(f, p)) && !cfg.exclude.some((p) => match(f, p)));
const missing = cfg.include.filter((p) => !files.some((f) => match(f, p)));
if (missing.length) { console.error("allow-list entries with no tracked file:", missing); process.exit(1); }

const stage = mkdtempSync(join(tmpdir(), "public-export-"));
for (const f of files) { mkdirSync(dirname(join(stage, f)), { recursive: true }); cpSync(join(src, f), join(stage, f)); }

const TEXT = /\.(md|txt|json|js|mjs|cjs|ts|tsx|mts|css|html|py|sh|example|gitignore|yml|yaml|toml)$/i;
// The patterns are private (they name what must stay private), so they live in a file that is never exported.
const fpath = join(src, "tools", "export-forbidden.json");
const pats = existsSync(fpath) ? JSON.parse(readFileSync(fpath, "utf8")).forbidden.map((s) => new RegExp(s)) : [];
if (!pats.length) console.error("note: no tools/export-forbidden.json — exporting without the private-pattern scan");
const hits = [];
for (const f of files) {
  if (!TEXT.test(f) && !f.endsWith(".env.example")) continue;
  readFileSync(join(stage, f), "utf8").split("\n").forEach((line, i) => {
    for (const re of pats) if (re.test(line)) hits.push(`${f}:${i + 1}: [${re.source}] ${line.trim().slice(0, 140)}`);
  });
}
const bytes = files.reduce((s, f) => s + statSync(join(stage, f)).size, 0);
console.log(JSON.stringify({ files: files.length, mb: Math.round(bytes / 1e5) / 10, staged: stage, forbidden_hits: hits.length }));
if (hits.length) { console.error(hits.join("\n")); rmSync(stage, { recursive: true, force: true }); process.exit(1); }

const target = process.argv[2];
if (!target || target === "--check") { rmSync(stage, { recursive: true, force: true }); process.exit(0); }
const out = resolve(target);
if (out === src || out.startsWith(src + "/")) { console.error("the export must live outside the source repository"); process.exit(1); }
mkdirSync(out, { recursive: true });
if (!existsSync(join(out, ".git"))) execFileSync("git", ["-C", out, "init", "-q", "-b", "main"]);
for (const e of readdirSync(out)) if (e !== ".git") rmSync(join(out, e), { recursive: true, force: true });
cpSync(stage, out, { recursive: true }); rmSync(stage, { recursive: true, force: true });
execFileSync("git", ["-C", out, "add", "-A"]);
const changed = execFileSync("git", ["-C", out, "status", "--porcelain"], { encoding: "utf8" }).trim();
if (changed) {
  const rev = execFileSync("git", ["-C", src, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  execFileSync("git", ["-C", out, "commit", "-q", "-m", process.env.EXPORT_MESSAGE || `Public snapshot (source ${rev})`]);
}
console.log(JSON.stringify({ exported: out, committed: !!changed }));
