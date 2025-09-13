// apps/api/src/jobs/tldCron.ts
import { db } from "../db/database";

const TLD_URL = "https://data.iana.org/TLD/tlds-alpha-by-domain.txt";

function parseTlds(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !!l && !l.startsWith("#"));
}

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchAndStoreTlds(): Promise<void> {
  const res = await fetch(TLD_URL, { headers: { Accept: "text/plain" } });
  const body = await res.text();
  if (!res.ok) throw new Error(`TLD fetch failed: ${res.status} ${body.slice(0, 200)}`);
  const tlds = parseTlds(body);
  const date = isoDateOnly(new Date());

  const resetActive = db.prepare("UPDATE tlds SET active = 0 WHERE active = 1");
  const upsert = db.prepare(
    `INSERT INTO tlds (tld, date_added, active)
     VALUES (?, ?, 1)
     ON CONFLICT(tld, date_added) DO UPDATE SET active = 1`
  );
  const tx = db.transaction((rows: string[]) => {
    resetActive.run();
    for (const tld of rows) upsert.run(tld, date);
  });
  tx(tlds);
  // eslint-disable-next-line no-console
  console.log(`[tld] stored ${tlds.length} TLDs for ${date}`);
}

function shouldRun(now: Date): boolean {
  return now.getUTCDate() === 1 && now.getUTCHours() === 12 && now.getUTCMinutes() === 0;
}

let lastRunKey: string | null = null;
function runKeyFor(now: Date): string {
  return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}-${now.getUTCMinutes()}`;
}

export function startTldCron() {
  // Check every 30 seconds to catch the exact minute
  setInterval(async () => {
    try {
      const now = new Date();
      if (!shouldRun(now)) return;
      const key = runKeyFor(now);
      if (lastRunKey === key) return; // avoid double-run in same minute
      lastRunKey = key;
      await fetchAndStoreTlds();
    } catch (e) {
      console.error("[tld] job error:", e);
    }
  }, 30_000).unref();
}

// Optionally expose a one-shot (could be used in a route for manual trigger)
export const runTldIngestOnce = fetchAndStoreTlds;
