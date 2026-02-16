// scripts/build-markets.mjs
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "data");
const OUT_FILE = path.join(OUT_DIR, "markets.json");

const SYMBOLS = {
  spx: "^spx",
  dji: "^dji",
};

async function fetchCsv(symbol) {
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; GithubActionsDashboard/1.0)",
      "Accept": "text/csv,*/*",
    },
  });
  if (!res.ok) throw new Error(`Stooq HTTP ${res.status} for ${symbol}`);
  return await res.text();
}

function parseCsv(csv) {
  const lines = csv.trim().split("\n");
  const headers = lines[0].split(",");
  const dateIdx = headers.indexOf("Date");
  const closeIdx = headers.indexOf("Close");
  if (dateIdx < 0 || closeIdx < 0) throw new Error("Unexpected CSV format");

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const d = cols[dateIdx];
    const c = cols[closeIdx];
    if (!d || !c) continue;
    const t = Date.parse(d);
    const close = Number(c);
    if (!Number.isFinite(t) || !Number.isFinite(close)) continue;
    out.push({ t, c: close });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

function keepRollingYear(arr) {
  const now = Date.now();
  const yearAgo = now - 365 * 24 * 60 * 60 * 1000;
  return arr.filter(p => p.t >= yearAgo && p.t <= now);
}

async function main() {
  const result = { updatedAt: new Date().toISOString() };

  for (const [key, sym] of Object.entries(SYMBOLS)) {
    const csv = await fetchCsv(sym);
    const parsed = parseCsv(csv);
    result[key] = keepRollingYear(parsed);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(result), "utf8");
  console.log(`Wrote ${OUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
