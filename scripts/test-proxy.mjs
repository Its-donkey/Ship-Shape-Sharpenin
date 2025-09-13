//scripts/test-proxy.mjs

// Simple Vite proxy smoke test with retries and colored output.
// Usage:
//   npm run dev   # start dev servers
//   npm test      # run combined test (server + proxy)
//
// Env vars (optional):
//   URL=http://localhost:5173/api/_debug
//   RETRIES=20
//   DELAY_MS=500

const url = process.env.URL || "http://localhost:5173/api/_debug";
const maxRetries = Number(process.env.RETRIES ?? 20);
const delayMs = Number(process.env.DELAY_MS ?? 500);

// ANSI colors
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function tryOnce() {
  const res = await fetch(url, { method: "GET" });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { /* not json */ }

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}\n${text.slice(0, 300)}`);
  }
  if (!json || json.ok !== true) {
    throw new Error(`Response is not { ok: true }.\n${text.slice(0, 300)}`);
  }
  return json;
}

(async () => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const json = await tryOnce();
      console.log(`${GREEN}[OK] Proxy working -> ${url}${RESET}`);
      if (Array.isArray(json.routes)) {
        console.log(
          `${YELLOW}Routes:${RESET} ${json.routes.map((r) => r.path).join(", ") || "(none listed)"}`
        );
      }
      process.exit(0);
    } catch (err) {
      if (attempt === maxRetries) {
        console.error(`${RED}[FAIL] ${url} after ${maxRetries} attempts${RESET}`);
        console.error(String(err?.message || err));
        process.exit(1);
      }
      process.stdout.write(
        `${YELLOW}[wait]${RESET} ${attempt}/${maxRetries} failed — retrying in ${delayMs}ms\r`
      );
      await sleep(delayMs);
    }
  }
})();
